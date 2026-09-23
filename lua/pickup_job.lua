-- KEYS[1] = queue name
-- ARGV[1] = workerId
-- ARGV[2] = lock TTL in seconds

-- 1. Pop the highest priority job (lowest score)
local job_data = redis.call('ZPOPMIN', KEYS[1], 1)

-- 2. Return nil if queue is empty
if not job_data[1] then
    return nil
end

local job_id = job_data[1]
local score = job_data[2]
local lock_key = 'lock:' .. job_id

-- 3. Attempt to acquire the lock
-- NX only sets if it doesn't exist; EX sets expiration in seconds
local locked = redis.call('SET', lock_key, ARGV[1], 'NX', 'EX', ARGV[2])

-- 4. If lock failed, put the job back with its original score
if not locked then
    redis.call('ZADD', KEYS[1], score, job_id)
    return nil
end

-- 5. Successfully locked; return the jobId
return job_id
