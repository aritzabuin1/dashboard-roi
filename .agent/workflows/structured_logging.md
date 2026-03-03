---
description: Implement structured logging for production observability
priority: HIGH
reusable: true
---

# Structured Logging Workflow

**Make your logs searchable, aggregatable, and actionable.**

## Purpose
Replace `print()` statements and basic logging with structured JSON logs that:
- Are easily searchable in Application Insights / CloudWatch / Datadog
- Support aggregation and metrics generation
- Include context (user_id, request_id, etc)
- Don't leak PII

## When to Use
- ✅ ALL production applications
- ✅ Azure Functions, AWS Lambda, Docker containers
- ✅ Any app that uses log aggregation services

---

## Implementation

### 1. Basic Setup
```python
import logging
import json
from datetime import datetime

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler()  # Console output
    ]
)

logger = logging.getLogger(__name__)
```

---

### 2. Structured Logger Class
```python
# shared/structured_logger.py
import logging
import json
from datetime import datetime
from typing import Any

class StructuredLogger:
    """Logger that outputs JSON for easy parsing by log aggregators"""

    def __init__(self, name: str, default_context: dict = None):
        self.logger = logging.getLogger(name)
        self.default_context = default_context or {}

    def _build_log_entry(self, level: str, message: str, **kwargs) -> dict:
        """Build structured log entry"""
        entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': level,
            'logger': self.logger.name,
            'message': message,
            **self.default_context,  # Include default context
            **kwargs  # Include custom fields
        }
        return entry

    def info(self, message: str, **kwargs):
        """Log INFO level with structured fields"""
        entry = self._build_log_entry('INFO', message, **kwargs)
        self.logger.info(json.dumps(entry))

    def warning(self, message: str, **kwargs):
        """Log WARNING level with structured fields"""
        entry = self._build_log_entry('WARNING', message, **kwargs)
        self.logger.warning(json.dumps(entry))

    def error(self, message: str, **kwargs):
        """Log ERROR level with structured fields"""
        entry = self._build_log_entry('ERROR', message, **kwargs)
        self.logger.error(json.dumps(entry))

    def critical(self, message: str, **kwargs):
        """Log CRITICAL level with structured fields"""
        entry = self._build_log_entry('CRITICAL', message, **kwargs)
        self.logger.critical(json.dumps(entry))

    def event(self, event_type: str, **kwargs):
        """Log custom event with structured fields"""
        entry = self._build_log_entry('INFO', f'Event: {event_type}', event_type=event_type, **kwargs)
        self.logger.info(json.dumps(entry))


# Usage
logger = StructuredLogger('my_app', default_context={'environment': 'production'})

logger.info(
    'User logged in',
    user_id='user_123',
    ip_address='192.168.1.1',
    duration_ms=245
)

# Output:
# {"timestamp": "2026-02-01T10:30:00Z", "level": "INFO", "logger": "my_app",
#  "message": "User logged in", "environment": "production",
#  "user_id": "user_123", "ip_address": "192.168.1.1", "duration_ms": 245}
```

---

### 3. Event-Based Logging
```python
# Log different event types with consistent structure

# Alert sent
logger.event(
    'alert_sent',
    machine_id='ESP-001',
    alert_type='temperature',
    severity='high',
    recipient='+34XXX',  # Truncated for privacy
    success=True,
    response_time_ms=234
)

# API call
logger.event(
    'api_call',
    service='whatsapp_api',
    endpoint='/messages',
    method='POST',
    status_code=200,
    duration_ms=156,
    retry_count=0
)

# Error occurred
logger.error(
    'Failed to send notification',
    error_type='ConnectionError',
    error_message='Connection timeout after 30s',
    machine_id='ESP-002',
    retry_count=3,
    will_retry=False
)

# Business metric
logger.event(
    'report_generated',
    report_type='weekly',
    recipient='owner@cafe.com',
    total_cups=1156,
    total_margin=3023.45,
    generation_time_ms=450
)
```

---

### 4. Context Managers for Request Tracing
```python
from contextvars import ContextVar
import uuid

# Context variable for request ID (thread-safe)
request_id_var: ContextVar[str] = ContextVar('request_id', default=None)

class RequestContext:
    """Context manager to track request across logs"""

    def __init__(self, request_id: str = None):
        self.request_id = request_id or str(uuid.uuid4())

    def __enter__(self):
        request_id_var.set(self.request_id)
        return self.request_id

    def __exit__(self, *args):
        request_id_var.set(None)


class StructuredLoggerWithContext(StructuredLogger):
    """Logger that automatically includes request context"""

    def _build_log_entry(self, level: str, message: str, **kwargs) -> dict:
        entry = super()._build_log_entry(level, message, **kwargs)

        # Add request_id if available
        request_id = request_id_var.get()
        if request_id:
            entry['request_id'] = request_id

        return entry


# Usage
logger = StructuredLoggerWithContext('api')

with RequestContext() as req_id:
    logger.info('Request received', endpoint='/api/alerts')

    # ... process request ...

    logger.info('Database query executed', duration_ms=45)
    logger.info('Response sent', status_code=200)

# All 3 logs will have the same request_id for correlation
```

---

### 5. PII-Safe Logging
```python
import hashlib

class SafeStructuredLogger(StructuredLogger):
    """Logger that automatically hashes PII"""

    PII_FIELDS = {'email', 'phone', 'phone_number', 'dni', 'credit_card'}

    def _sanitize_value(self, key: str, value: Any) -> Any:
        """Hash PII fields, keep others as-is"""
        if key.lower() in self.PII_FIELDS and isinstance(value, str):
            # Return first 8 chars of SHA256 hash
            return hashlib.sha256(value.encode()).hexdigest()[:8]
        return value

    def _build_log_entry(self, level: str, message: str, **kwargs) -> dict:
        # Sanitize all kwargs
        sanitized_kwargs = {
            k: self._sanitize_value(k, v) for k, v in kwargs.items()
        }
        return super()._build_log_entry(level, message, **sanitized_kwargs)


# Usage
safe_logger = SafeStructuredLogger('app')

safe_logger.info(
    'User registered',
    email='user@example.com',  # Will be hashed automatically
    user_id='user_123',  # Not PII, kept as-is
    phone='+34600123456'  # Will be hashed automatically
)

# Output: {"email": "b4c2a8f1", "user_id": "user_123", "phone": "a7f3c9d2"}
```

---

### 6. Performance Logging
```python
from time import time
from functools import wraps

def log_performance(logger: StructuredLogger):
    """Decorator to log function execution time"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time() - start) * 1000

                logger.info(
                    f'Function {func.__name__} completed',
                    function=func.__name__,
                    duration_ms=round(duration_ms, 2),
                    success=True
                )
                return result
            except Exception as e:
                duration_ms = (time() - start) * 1000
                logger.error(
                    f'Function {func.__name__} failed',
                    function=func.__name__,
                    duration_ms=round(duration_ms, 2),
                    error_type=type(e).__name__,
                    error_message=str(e),
                    success=False
                )
                raise
        return wrapper
    return decorator


# Usage
logger = StructuredLogger('performance')

@log_performance(logger)
def generate_report(data):
    # ... expensive operation ...
    return report

# Automatically logs execution time and success/failure
```

---

### 7. Integration with Application Insights
```python
# For Azure Functions
import logging
import os

# Application Insights is automatically configured
# Just use standard logging, Azure handles the rest

logger = StructuredLogger('azure_function')

def main(req):
    logger.info(
        'Function triggered',
        trigger_type='http',
        method=req.method,
        url=req.url
    )

    # ... process request ...

    logger.info('Function completed', duration_ms=234)
```

**Query logs in Application Insights:**
```kusto
traces
| where customDimensions.event_type == "alert_sent"
| where customDimensions.success == true
| summarize count() by bin(timestamp, 1h), tostring(customDimensions.alert_type)
| render timechart
```

---

### 8. Log Levels Guide

| Level | When to Use | Example |
|:------|:------------|:--------|
| **DEBUG** | Development only, verbose details | `logger.debug('Variable x =', x=42)` |
| **INFO** | Normal operations, state changes | `logger.info('Alert sent', machine_id='ESP-001')` |
| **WARNING** | Recoverable issues, degraded performance | `logger.warning('Retry attempt 2/3', error='Timeout')` |
| **ERROR** | Errors that need attention | `logger.error('Failed to send', error='ConnectionError')` |
| **CRITICAL** | System failures, requires immediate action | `logger.critical('Database unreachable')` |

---

### 9. Standard Fields to Include

**Always include:**
- `timestamp` - ISO 8601 format
- `level` - Log level
- `message` - Human-readable message
- `logger` - Logger name (module)

**Include when relevant:**
- `request_id` / `correlation_id` - Trace requests
- `user_id` - User context (hashed if PII)
- `machine_id` / `resource_id` - Resource being operated on
- `duration_ms` - Performance metrics
- `error_type` / `error_message` - For errors
- `success` - Boolean outcome
- `retry_count` - Retry attempts

---

### 10. Anti-Patterns to Avoid

❌ **DON'T:**
```python
# String interpolation (not searchable)
logging.info(f"User {user_id} did action {action}")

# Logging PII directly
logging.info(f"User email: {email}")

# Using print() in production
print("Something happened")

# Logging inside tight loops
for item in million_items:
    logging.info(f"Processing {item}")  # Too much log volume
```

✅ **DO:**
```python
# Structured fields (searchable)
logger.info('User action', user_id=user_id, action=action)

# Hash PII
logger.info('User registered', email_hash=hash(email))

# Use proper logger
logger.info('Application started')

# Log summary after loop
logger.info('Batch processed', item_count=len(million_items), duration_ms=450)
```

---

### 11. Testing Structured Logs
```python
import pytest
from unittest.mock import patch
import json

def test_structured_log_format():
    """Verify logs are valid JSON"""
    logger = StructuredLogger('test')

    with patch('logging.Logger.info') as mock_log:
        logger.info('Test message', user_id='123', count=5)

        # Get the log message
        log_message = mock_log.call_args[0][0]

        # Verify it's valid JSON
        log_data = json.loads(log_message)

        assert log_data['message'] == 'Test message'
        assert log_data['user_id'] == '123'
        assert log_data['count'] == 5
        assert 'timestamp' in log_data

def test_pii_is_hashed():
    """Verify PII fields are hashed"""
    logger = SafeStructuredLogger('test')

    with patch('logging.Logger.info') as mock_log:
        logger.info('User action', email='test@example.com')

        log_data = json.loads(mock_log.call_args[0][0])

        # Email should be hashed (8 chars)
        assert len(log_data['email']) == 8
        assert log_data['email'] != 'test@example.com'
```

---

### 12. Log Aggregation Queries

**Application Insights (KQL):**
```kusto
// Count alerts by type
traces
| where message contains "alert_sent"
| summarize count() by tostring(customDimensions.alert_type)

// Average response time
traces
| where message contains "api_call"
| summarize avg(tolong(customDimensions.duration_ms)) by bin(timestamp, 5m)

// Error rate
traces
| where level == "ERROR"
| summarize error_count=count() by bin(timestamp, 1h)
```

**CloudWatch Insights:**
```
fields @timestamp, message, user_id, duration_ms
| filter event_type = "api_call"
| stats avg(duration_ms) by bin(5m)
```

---

## Migration Guide

### From print() to structured logging:
```python
# BEFORE
print(f"Processing machine {machine_id}")
print(f"Alert sent successfully")

# AFTER
logger.info('Processing started', machine_id=machine_id)
logger.info('Alert sent', machine_id=machine_id, success=True)
```

### From basic logging to structured:
```python
# BEFORE
logging.info(f"User {user_id} logged in from {ip}")

# AFTER
logger.info('User logged in', user_id=user_id, ip_address=ip)
```

---

## Quick Setup Template

```python
# shared/logger.py
import logging
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    def info(self, message: str, **kwargs):
        entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': 'INFO',
            'message': message,
            **kwargs
        }
        self.logger.info(json.dumps(entry))

    def error(self, message: str, **kwargs):
        entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': 'ERROR',
            'message': message,
            **kwargs
        }
        self.logger.error(json.dumps(entry))

# Usage in any module
from shared.logger import StructuredLogger
logger = StructuredLogger(__name__)

logger.info('Operation completed', user_id='123', duration_ms=45)
```

---

## Summary
- ✅ Use structured JSON logs for all production apps
- ✅ Include searchable fields (user_id, request_id, etc)
- ✅ Hash or truncate PII before logging
- ✅ Use consistent field names across the app
- ✅ Log events (not just messages) for metrics
- ✅ Test that logs are valid JSON

**Copy this pattern to ANY project for production-grade observability.**
