-- KEYS[1] = lock key (e.g. lock:<jobId>)
-- ARGV[1] = workerId
-- ARGV[2] = new TTL in seconds

-- 1. Check current owner
local owner = redis.call('GET', KEYS[1])

-- 2. If this worker owns the lock, extend TTL
if owner == ARGV[1] then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 1
end

-- 3. Otherwise, do nothing
return 0