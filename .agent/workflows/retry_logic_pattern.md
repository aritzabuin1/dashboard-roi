---
description: Add resilient retry logic to external API calls
priority: HIGH
reusable: true
---

# Retry Logic Pattern Workflow

**Make your application resilient to transient failures.**

## Purpose
Implement exponential backoff retry logic for all external API calls to handle:
- Temporary network issues
- Rate limits (429)
- Server errors (500, 502, 503)
- Timeout errors

## When to Use
- ✅ ALL external API calls (REST, GraphQL, gRPC)
- ✅ Database connections
- ✅ Cloud storage operations
- ✅ Third-party services (WhatsApp, Stripe, Twilio, etc)

❌ **Don't use for:**
- Internal function calls
- User input validation
- Idempotent operations that shouldn't retry (DELETE, etc)

---

## Implementation

### 1. Install tenacity
```bash
pip install tenacity
```

Add to `requirements.txt`:
```
tenacity>=8.0.0
```

---

### 2. Basic Pattern
```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import requests

@retry(
    stop=stop_after_attempt(3),  # Max 3 attempts
    wait=wait_exponential(multiplier=1, min=2, max=10),  # 2s, 4s, 8s
    retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError))
)
def call_external_api(url: str, payload: dict):
    """Template for any external API call"""
    response = requests.post(
        url,
        json=payload,
        timeout=30,  # Always include timeout!
        headers={'User-Agent': 'YourApp/1.0'}
    )
    response.raise_for_status()  # Raises HTTPError for 4xx/5xx
    return response.json()

# Usage
try:
    result = call_external_api('https://api.example.com/endpoint', {'data': 'value'})
except Exception as e:
    # Failed after 3 retries
    logging.error(f"API call failed after retries: {e}")
```

---

### 3. Advanced Pattern (with different strategies per error)
```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    retry_if_result,
    before_sleep_log
)
import logging

logger = logging.getLogger(__name__)

def is_rate_limited(response):
    """Check if response indicates rate limiting"""
    return response.status_code == 429 if response else False

@retry(
    # Stop conditions
    stop=stop_after_attempt(5),

    # Wait strategy
    wait=wait_exponential(multiplier=2, min=4, max=60),  # 4s, 8s, 16s, 32s, 60s

    # Retry conditions
    retry=(
        retry_if_exception_type((requests.Timeout, requests.ConnectionError)) |
        retry_if_result(is_rate_limited)
    ),

    # Logging
    before_sleep=before_sleep_log(logger, logging.WARNING)
)
def robust_api_call(url: str, payload: dict):
    """Production-ready API call with comprehensive retry logic"""
    response = requests.post(
        url,
        json=payload,
        timeout=30,
        headers={
            'User-Agent': 'YourApp/1.0',
            'Content-Type': 'application/json'
        }
    )

    # Don't retry on client errors (4xx except 429)
    if 400 <= response.status_code < 500 and response.status_code != 429:
        response.raise_for_status()  # Raises immediately, no retry

    # Retry on server errors (5xx) and 429
    if response.status_code >= 500 or response.status_code == 429:
        raise requests.HTTPError(f"Server error: {response.status_code}")

    return response.json()
```

---

### 4. Custom Retry Conditions
```python
from tenacity import retry, stop_after_attempt, retry_if_exception

class RateLimitError(Exception):
    """Custom exception for rate limiting"""
    pass

class TemporaryError(Exception):
    """Errors that should be retried"""
    pass

@retry(
    stop=stop_after_attempt(3),
    retry=retry_if_exception(lambda e: isinstance(e, (TemporaryError, RateLimitError)))
)
def smart_api_call(endpoint: str):
    try:
        response = requests.get(endpoint, timeout=30)

        if response.status_code == 429:
            raise RateLimitError("Rate limit exceeded")
        elif response.status_code >= 500:
            raise TemporaryError(f"Server error: {response.status_code}")
        elif response.status_code >= 400:
            # Don't retry client errors
            raise ValueError(f"Client error: {response.status_code}")

        return response.json()
    except requests.Timeout:
        raise TemporaryError("Request timeout")
    except requests.ConnectionError:
        raise TemporaryError("Connection failed")
```

---

### 5. Async Version (for async/await)
```python
from tenacity import retry, stop_after_attempt, wait_exponential
import aiohttp

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=2, max=10)
)
async def async_api_call(url: str, payload: dict):
    """Async version with retry logic"""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            response.raise_for_status()
            return await response.json()

# Usage
import asyncio
result = asyncio.run(async_api_call('https://api.example.com', {}))
```

---

### 6. Database Connection with Retry
```python
from tenacity import retry, stop_after_delay, wait_fixed
import psycopg2

@retry(
    stop=stop_after_delay(30),  # Stop after 30 seconds
    wait=wait_fixed(2)  # Wait 2 seconds between attempts
)
def connect_to_database():
    """Retry database connection during startup"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        connect_timeout=10
    )

# Usage: Will retry for up to 30 seconds
db_conn = connect_to_database()
```

---

### 7. WhatsApp API Example (from Cafes Cornella)
```python
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log
import requests
import logging

logger = logging.getLogger(__name__)

class WhatsAppClient:
    def __init__(self):
        self.access_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
        self.phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')
        self.base_url = f"https://graph.facebook.com/v19.0/{self.phone_number_id}/messages"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError, requests.HTTPError)),
        before_sleep=before_sleep_log(logger, logging.WARNING)
    )
    def send_message(self, to: str, message: str) -> dict:
        """Send WhatsApp message with automatic retries"""
        response = requests.post(
            self.base_url,
            json={
                'messaging_product': 'whatsapp',
                'to': to,
                'type': 'text',
                'text': {'body': message}
            },
            headers={
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        # Don't retry on invalid recipient (400)
        if response.status_code == 400:
            raise ValueError(f"Invalid WhatsApp recipient: {to}")

        # Retry on rate limit or server errors
        response.raise_for_status()
        return response.json()
```

---

## Best Practices

### ✅ DO:
1. **Always set max attempts** - Prevent infinite loops
2. **Use exponential backoff** - Don't overwhelm the server
3. **Include timeout** - Prevent hanging requests
4. **Log retries** - Use `before_sleep_log` for observability
5. **Distinguish errors** - Retry transient errors, fail fast on permanent ones
6. **Be specific** - Only retry specific exception types

### ❌ DON'T:
1. **Don't retry authentication errors** (401, 403)
2. **Don't retry validation errors** (400, 422)
3. **Don't retry without backoff** - You'll DDoS yourself
4. **Don't retry forever** - Always have a stop condition
5. **Don't retry destructive operations** - Unless idempotent

---

## Error Classification

| Error Type | Retry? | Example |
|:-----------|:-------|:--------|
| Network timeout | ✅ YES | `requests.Timeout` |
| Connection error | ✅ YES | `requests.ConnectionError` |
| 429 Rate limit | ✅ YES | With longer backoff |
| 500 Server error | ✅ YES | Server is overloaded |
| 502/503 Bad Gateway | ✅ YES | Service temporarily down |
| 400 Bad request | ❌ NO | Your request is invalid |
| 401 Unauthorized | ❌ NO | Your credentials are wrong |
| 404 Not found | ❌ NO | Resource doesn't exist |

---

## Testing Retry Logic

```python
import pytest
from unittest.mock import Mock, patch

def test_retry_succeeds_on_second_attempt():
    """Test that function retries and succeeds"""
    mock_api = Mock()
    mock_api.side_effect = [
        requests.Timeout(),  # First call fails
        {'status': 'success'}  # Second call succeeds
    ]

    with patch('requests.post', mock_api):
        result = call_external_api('http://test.com', {})

    assert result == {'status': 'success'}
    assert mock_api.call_count == 2

def test_retry_fails_after_max_attempts():
    """Test that function fails after max retries"""
    mock_api = Mock()
    mock_api.side_effect = requests.Timeout()  # Always fails

    with patch('requests.post', mock_api):
        with pytest.raises(requests.Timeout):
            call_external_api('http://test.com', {})

    assert mock_api.call_count == 3  # Max attempts
```

---

## Monitoring Retry Behavior

```python
from tenacity import RetryCallState

def log_retry_attempt(retry_state: RetryCallState):
    """Custom logging for retry attempts"""
    logger.warning(
        f"Retry attempt {retry_state.attempt_number} "
        f"after {retry_state.seconds_since_start:.2f}s "
        f"due to {retry_state.outcome.exception()}"
    )

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(min=2, max=10),
    after=log_retry_attempt  # Custom callback
)
def monitored_api_call(url: str):
    return requests.get(url, timeout=30).json()
```

---

## Quick Reference

```python
# Basic retry (most common)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def basic_retry():
    pass

# Retry with specific exceptions
@retry(
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((Timeout, ConnectionError))
)
def specific_exceptions():
    pass

# Retry with timeout
@retry(stop=stop_after_delay(60))  # Stop after 60 seconds total
def time_limited_retry():
    pass

# Retry with custom condition
@retry(retry=retry_if_result(lambda x: x is None))
def retry_until_not_none():
    return get_data_or_none()
```

---

## Integration with Cost Tracking

```python
from execution.cost_tracker import CostTracker

tracker = CostTracker()

@retry(stop=stop_after_attempt(3))
def api_call_with_cost_tracking(url: str):
    result = requests.post(url, timeout=30).json()

    # Track cost (e.g., paid API)
    tracker.log_api_call('third_party_api', count=1)

    return result
```

---

## Summary
- ✅ Use `tenacity` for all external API calls
- ✅ Exponential backoff prevents overwhelming servers
- ✅ Distinguish between retryable and non-retryable errors
- ✅ Always include timeout to prevent hanging
- ✅ Log retry attempts for observability
- ✅ Test retry logic with mocks

**Copy this pattern to ANY project that calls external APIs.**
