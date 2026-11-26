/**
 * Runs the production Redis Lua script in a Lua VM (fengari) against a tiny
 * fake Redis, and checks it makes exactly the same choices as lib/engine.ts.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error no types for fengari
import fengari from "fengari";
import { choosePrize, type EnginePrize } from "@/lib/engine";
import { ALLOCATE_LUA } from "@/lib/store/allocate.lua";

const { lua, lauxlib, lualib, to_luastring } = fengari;

const FAKE_REDIS = `
DB = {}
redis = {}
function redis.call(cmd, key, a, b, c)
  if cmd == 'GET' then local v = DB[key]; if v == nil then return false end; return v end
  if cmd == 'SET' then if c == 'NX' or b == 'NX' then if DB[key] ~= nil then return false end end; DB[key] = a; return 'OK' end
  if cmd == 'INCR' then local v = tonumber(DB[key] or '0') + 1; DB[key] = tostring(v); return v end
  if cmd == 'DECR' then local v = tonumber(DB[key] or '0') - 1; DB[key] = tostring(v); return v end
  if cmd == 'HGET' then local h = DB[key]; if h == nil or h[a] == nil then return false end; return h[a] end
  if cmd == 'HSET' then DB[key] = DB[key] or {}; DB[key][a] = b; return 1 end
  if cmd == 'HINCRBY' then DB[key] = DB[key] or {}; local v = tonumber(DB[key][a] or '0') + b; DB[key][a] = tostring(v); return v end
  error('unsupported ' .. cmd)
end
`;

function luaStr(s: string) {
  return "[==[" + s + "]==]";
}

function makeVm() {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  if (lauxlib.luaL_dostring(L, to_luastring(FAKE_REDIS)) !== 0) throw new Error("fake redis failed");
  const fn = `function __alloc()\n${ALLOCATE_LUA}\nend`;
  if (lauxlib.luaL_dostring(L, to_luastring(fn)) !== 0) throw new Error(lua.lua_tojsstring(L, -1));
  return {
    run(keys: string[], argv: string[]): string[] {
      const code =
        `KEYS = {${keys.map(luaStr).join(",")}}\nARGV = {${argv.map(luaStr).join(",")}}\n` +
        `local r = __alloc()\nOUT = table.concat(r, "\\n")`;
      if (lauxlib.luaL_dostring(L, to_luastring(code)) !== 0) throw new Error(lua.lua_tojsstring(L, -1));
      lua.lua_getglobal(L, to_luastring("OUT"));
      const out = lua.lua_tojsstring(L, -1);
      lua.lua_pop(L, 1);
      return out.split("\n");
    },
  };
}

function randomPrizes(): Omit<EnginePrize, "given">[] {
  const n = 1 + Math.floor(Math.random() * 5);
  const usedTurns = new Set<number>();
  return Array.from({ length: n }, (_, i) => {
    const turns: number[] = [];
    if (Math.random() < 0.3) {
      const t = 1 + Math.floor(Math.random() * 30);
      if (!usedTurns.has(t)) {
        usedTurns.add(t);
        turns.push(t);
      }
    }
    return {
      id: `p${i}`,
      quantity: Math.floor(Math.random() * 8),
      chancePercent: Math.random() < 0.2 ? 0 : Math.floor(Math.random() * 60),
      guaranteedTurns: turns,
      isJackpot: turns.length > 0 && Math.random() < 0.5,
    };
  });
}

describe("Redis Lua script matches the TypeScript engine", () => {
  it("makes identical choices over thousands of random scenarios", () => {
    for (let scenario = 0; scenario < 150; scenario++) {
      const vm = makeVm();
      const prizes = randomPrizes();
      const pickMode = Math.random() < 0.5 ? "fixed_chance" : "weighted_by_remaining";
      const fallbackId = Math.random() < 0.6 ? prizes[0].id : null;
      const given: Record<string, number> = {};
      let turn = 0;
      for (let g = 0; g < 40; g++) {
        const rand = Math.random();
        const expected = choosePrize({
          turn: turn + 1,
          prizes: prizes.map((p) => ({ ...p, given: given[p.id] ?? 0 })),
          pickMode,
          fallbackId,
          rand,
        });
        const argv = [`dev${g}`, "1", pickMode, fallbackId ?? "", String(rand), "1000", String(prizes.length)];
        for (const p of prizes) argv.push(p.id, String(p.quantity), String(p.chancePercent), p.guaranteedTurns.join(","), p.isJackpot ? "1" : "0");
        const res = vm.run(["t", "g", "a", "j"], argv);
        if (expected === null) {
          expect(res).toEqual(["none"]);
        } else {
          turn++;
          given[expected] = (given[expected] ?? 0) + 1;
          expect(res[0]).toBe("ok");
          expect(res[1]).toBe(`dev${g}`);
          expect(res[2]).toBe(`${turn}|${expected}|1000|dev${g}`);
        }
      }
    }
  });

  it("returns the existing allocation for a returning device", () => {
    const vm = makeVm();
    const argv = ["devA", "1", "fixed_chance", "x", "0.5", "1", "1", "x", "5", "100", "", "0"];
    const first = vm.run(["t", "g", "a", "j"], argv);
    const second = vm.run(["t", "g", "a", "j"], argv);
    expect(first[0]).toBe("ok");
    expect(second).toEqual(["existing", "devA", first[2]]);
  });
});
