-- KEYS[1] = job hash key (e.g. <id>)
-- KEYS[2] = main queue (ZSET)
-- KEYS[3] = dead letter queue (ZSET)

-- ARGV[1] = maxRetries
-- ARGV[2] = current timestamp (ms)
-- ARGV[3] = error message

local jobId = "job:" .. KEYS[1];

-- 1. Get current attempts (default 0)
local attempts = tonumber(redis.call("HGET", jobId, "attempts")) or 0
attempts = attempts + 1

-- 2. Update attempts + last error
redis.call("HSET", jobId,
    "attempts", attempts,
    "lastError", ARGV[3]
)

local maxRetries = tonumber(ARGV[1])

-- 3. Check retry limit
if attempts >= maxRetries then
    -- Move to Dead Letter Queue
    redis.call("ZADD", KEYS[3], ARGV[2], KEYS[1])
    redis.call("HSET", jobId, "status", "FAILED")
    return "dlq"
else
    -- 4. Exponential backoff (in ms)
    local delay = (2 ^ attempts) * 1000
    local nextRunTime = tonumber(ARGV[2]) + delay

    -- 5. Requeue with delay
    redis.call("ZADD", KEYS[2], nextRunTime, KEYS[1])
    redis.call("HSET", jobId, "status", "RETRYING")

    return "retry"
end