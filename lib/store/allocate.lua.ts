/**
 * Atomic allocation script for Redis. It mirrors lib/engine.ts choosePrize()
 * exactly; Redis runs a script as one indivisible step, so 100 simultaneous
 * taps are processed one after another and stock can never go negative.
 *
 * KEYS: 1 turn counter, 2 given-per-prize hash, 3 allocations hash, 4 jackpot key
 * ARGV: 1 deviceId, 2 onePerDevice (1/0), 3 pickMode, 4 fallbackId ("" = none),
 *       5 rand [0,1), 6 now (ms), 7 prize count,
 *       then per prize 5 values: id, quantity, chancePercent, guaranteedTurns csv, isJackpot (1/0)
 *
 * Returns {"existing"|"ok", allocId, record} or {"none"}.
 * record = "turn|prizeId|at|deviceId"
 */
export const ALLOCATE_LUA = `
local turnKey, givenKey, allocKey, jackpotKey = KEYS[1], KEYS[2], KEYS[3], KEYS[4]
local deviceId = ARGV[1]
local onePer = ARGV[2] == '1'
local mode = ARGV[3]
local fallback = ARGV[4]
local rand = tonumber(ARGV[5])
local now = ARGV[6]
local n = tonumber(ARGV[7])

if onePer then
  local existing = redis.call('HGET', allocKey, deviceId)
  if existing then return {'existing', deviceId, existing} end
end

local turn = tonumber(redis.call('INCR', turnKey))

local prizes = {}
local idx = 8
for i = 1, n do
  local p = { id = ARGV[idx], qty = tonumber(ARGV[idx + 1]), chance = tonumber(ARGV[idx + 2]), turns = {}, jackpot = ARGV[idx + 4] == '1' }
  for t in string.gmatch(ARGV[idx + 3], '%d+') do p.turns[#p.turns + 1] = tonumber(t) end
  p.given = tonumber(redis.call('HGET', givenKey, p.id) or '0') or 0
  prizes[i] = p
  idx = idx + 5
end

local chosen = nil

-- 1. guaranteed turns
for i = 1, n do
  local p = prizes[i]
  if chosen == nil and p.given < p.qty then
    for _, t in ipairs(p.turns) do
      if t == turn then chosen = p break end
    end
  end
end

-- 2. random pick (stock reserved for future guaranteed turns is held back)
if chosen == nil then
  local cands = {}
  local total = 0
  for i = 1, n do
    local p = prizes[i]
    if p.chance > 0 then
      local reserved = 0
      for _, t in ipairs(p.turns) do if t > turn then reserved = reserved + 1 end end
      local available = p.qty - p.given - reserved
      if available > 0 then
        local w = p.chance
        if mode ~= 'fixed_chance' then w = available end
        cands[#cands + 1] = { p = p, w = w }
        total = total + w
      end
    end
  end
  if total > 0 then
    local r = rand * total
    local acc = 0
    for _, c in ipairs(cands) do
      acc = acc + c.w
      if chosen == nil and r < acc then chosen = c.p end
    end
    if chosen == nil then chosen = cands[#cands].p end
  end
end

-- 3. fallback
if chosen == nil and fallback ~= '' then
  for i = 1, n do
    if prizes[i].id == fallback then chosen = prizes[i] end
  end
end

if chosen == nil then
  redis.call('DECR', turnKey)
  return {'none'}
end

redis.call('HINCRBY', givenKey, chosen.id, 1)
local allocId = deviceId
if not onePer then allocId = deviceId .. '#' .. turn end
local record = turn .. '|' .. chosen.id .. '|' .. now .. '|' .. deviceId
redis.call('HSET', allocKey, allocId, record)
if chosen.jackpot then
  redis.call('SET', jackpotKey, turn .. '|' .. allocId, 'NX')
end
return {'ok', allocId, record}
`;
