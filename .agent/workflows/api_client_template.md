---
description: Template for creating production-ready API clients
priority: HIGH
reusable: true
---

# API Client Template Workflow

**Build robust, testable API clients for any external service.**

## Purpose
Standardized template for creating API clients with:
- ✅ Retry logic (automatic error recovery)
- ✅ Pydantic validation (type safety)
- ✅ Mock mode (test without hitting real APIs)
- ✅ Rate limiting (respect API limits)
- ✅ Cost tracking (monitor expenses)
- ✅ Structured logging (observability)

## When to Use
- ✅ Integrating ANY third-party API
- ✅ WhatsApp, Stripe, Twilio, SendGrid, etc
- ✅ Internal microservices communication

---

## Complete Template

```python
# shared/api_client_template.py
"""
Production-ready API client template.
Copy this and customize for your API.
"""

import os
import requests
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from datetime import datetime, timedelta
import logging
from collections import defaultdict

# Optional: Import your cost tracker and structured logger
# from shared.cost_tracker import CostTracker
# from shared.structured_logger import StructuredLogger

logger = logging.getLogger(__name__)


# ========================================
# 1. PYDANTIC MODELS (Request & Response)
# ========================================

class APIRequest(BaseModel):
    """Validated request payload"""
    recipient: str = Field(..., min_length=1)
    message: str = Field(..., max_length=1000)
    priority: str = Field(default='normal', regex='^(low|normal|high)$')

    @validator('recipient')
    def validate_recipient(cls, v):
        """Custom validation logic"""
        if not v.startswith('+'):
            raise ValueError('Recipient must start with +')
        return v


class APIResponse(BaseModel):
    """Validated response from API"""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ========================================
# 2. API CLIENT CLASS
# ========================================

class ExampleAPIClient:
    """
    Production-ready API client template.

    Features:
    - Automatic retries with exponential backoff
    - Pydantic validation
    - Mock mode for testing
    - Rate limiting
    - Cost tracking (optional)
    - Structured logging
    """

    def __init__(
        self,
        api_key: str = None,
        base_url: str = None,
        mock_mode: bool = None,
        rate_limit: int = 100  # requests per minute
    ):
        """
        Initialize API client.

        Args:
            api_key: API authentication token (defaults to env var)
            base_url: API base URL (defaults to env var)
            mock_mode: Enable mock responses (defaults to ENVIRONMENT != production)
            rate_limit: Max requests per minute
        """
        self.api_key = api_key or os.getenv('API_KEY')
        self.base_url = base_url or os.getenv('API_BASE_URL', 'https://api.example.com/v1')
        self.mock_mode = mock_mode if mock_mode is not None else (os.getenv('ENVIRONMENT') != 'production')
        self.rate_limit = rate_limit

        # Rate limiting state
        self._rate_limit_window = timedelta(minutes=1)
        self._request_timestamps = []

        # Validate configuration
        if not self.mock_mode and not self.api_key:
            raise ValueError("API_KEY is required in production mode")

        logger.info(f"API Client initialized (mock_mode={self.mock_mode})")

    def _check_rate_limit(self):
        """Enforce rate limiting"""
        now = datetime.utcnow()
        window_start = now - self._rate_limit_window

        # Remove old timestamps
        self._request_timestamps = [
            ts for ts in self._request_timestamps if ts > window_start
        ]

        # Check limit
        if len(self._request_timestamps) >= self.rate_limit:
            wait_time = (self._request_timestamps[0] - window_start).total_seconds()
            raise Exception(f"Rate limit exceeded. Retry after {wait_time:.1f}s")

        # Record this request
        self._request_timestamps.append(now)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)),
        before_sleep=lambda retry_state: logger.warning(
            f"Retry attempt {retry_state.attempt_number} after {retry_state.outcome.exception()}"
        )
    )
    def _make_request(
        self,
        endpoint: str,
        method: str = 'POST',
        payload: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Make HTTP request with retry logic.

        Args:
            endpoint: API endpoint (e.g., '/messages')
            method: HTTP method
            payload: Request body

        Returns:
            Response JSON

        Raises:
            requests.HTTPError: On 4xx/5xx errors
            requests.Timeout: On timeout
        """
        url = f"{self.base_url}{endpoint}"

        response = requests.request(
            method=method,
            url=url,
            json=payload,
            headers={
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json',
                'User-Agent': 'YourApp/1.0'
            },
            timeout=30  # Always include timeout!
        )

        # Don't retry on client errors (4xx except 429)
        if 400 <= response.status_code < 500 and response.status_code != 429:
            response.raise_for_status()

        # Retry on server errors (5xx) and rate limit (429)
        if response.status_code >= 500 or response.status_code == 429:
            logger.warning(f"Server error {response.status_code}, will retry")
            response.raise_for_status()

        return response.json()

    def send_message(
        self,
        recipient: str,
        message: str,
        priority: str = 'normal'
    ) -> APIResponse:
        """
        Send message via API.

        Args:
            recipient: Recipient identifier (phone, email, etc)
            message: Message content
            priority: Message priority (low, normal, high)

        Returns:
            APIResponse with success status and message_id

        Raises:
            ValidationError: If inputs are invalid
            Exception: If API call fails after retries
        """
        # 1. Validate input with Pydantic
        request = APIRequest(
            recipient=recipient,
            message=message,
            priority=priority
        )

        # 2. MOCK MODE (for testing without hitting real API)
        if self.mock_mode:
            logger.info(f"[MOCK] Sending message to {recipient}: {message[:50]}...")
            return APIResponse(
                success=True,
                message_id=f'mock_{datetime.utcnow().timestamp()}',
                timestamp=datetime.utcnow()
            )

        # 3. Check rate limit
        self._check_rate_limit()

        # 4. Make API request
        try:
            response_data = self._make_request(
                endpoint='/messages',
                method='POST',
                payload=request.dict()
            )

            # 5. Parse and validate response
            response = APIResponse(
                success=True,
                message_id=response_data.get('id'),
                timestamp=datetime.utcnow()
            )

            # 6. Log success
            logger.info(
                f"Message sent successfully",
                extra={
                    'recipient': recipient[:10] + '...',  # Truncate PII
                    'message_id': response.message_id,
                    'priority': priority
                }
            )

            # 7. (Optional) Track cost
            # tracker.log_api_call('example_api', count=1, recipient=recipient)

            return response

        except requests.HTTPError as e:
            # 8. Handle errors
            logger.error(
                f"API call failed: {e}",
                extra={
                    'status_code': e.response.status_code if e.response else None,
                    'recipient': recipient[:10] + '...'
                }
            )
            return APIResponse(
                success=False,
                error=str(e),
                timestamp=datetime.utcnow()
            )

    def get_message_status(self, message_id: str) -> Dict[str, Any]:
        """
        Check message delivery status.

        Args:
            message_id: Message ID from send_message()

        Returns:
            Status information
        """
        if self.mock_mode:
            return {'status': 'delivered', 'message_id': message_id}

        return self._make_request(
            endpoint=f'/messages/{message_id}',
            method='GET'
        )


# ========================================
# 3. USAGE EXAMPLES
# ========================================

if __name__ == '__main__':
    # Development: Uses mock mode automatically
    client = ExampleAPIClient()

    # Send message
    response = client.send_message(
        recipient='+34600123456',
        message='Hello from API client template!',
        priority='high'
    )

    print(f"Success: {response.success}")
    print(f"Message ID: {response.message_id}")

    # Check status
    if response.message_id:
        status = client.get_message_status(response.message_id)
        print(f"Status: {status}")
```

---

## Customization Guide

### Step 1: Copy Template
```bash
cp shared/api_client_template.py shared/whatsapp_client.py
```

### Step 2: Update for Your API

#### A) Update Pydantic Models
```python
class WhatsAppRequest(BaseModel):
    """WhatsApp-specific request"""
    messaging_product: str = Field(default='whatsapp')
    recipient_type: str = Field(default='individual')
    to: str  # Phone number
    type: str = Field(default='text')
    text: Dict[str, str]  # {'body': 'message'}

    @validator('to')
    def validate_phone(cls, v):
        if not v.startswith('+'):
            raise ValueError('Phone must start with +')
        if len(v) < 10:
            raise ValueError('Phone too short')
        return v
```

#### B) Update API Endpoint & Auth
```python
class WhatsAppClient(ExampleAPIClient):
    def __init__(self):
        super().__init__(
            api_key=os.getenv('WHATSAPP_ACCESS_TOKEN'),
            base_url=f"https://graph.facebook.com/v19.0/{os.getenv('WHATSAPP_PHONE_NUMBER_ID')}",
            rate_limit=80  # WhatsApp: 80 messages per minute
        )
```

#### C) Customize Headers
```python
def _make_request(self, endpoint, method='POST', payload=None):
    headers = {
        'Authorization': f'Bearer {self.api_key}',
        'Content-Type': 'application/json',
        # Add custom headers
        'X-Custom-Header': 'value'
    }
    # ... rest of implementation
```

---

## Real-World Examples

### Example 1: WhatsApp Client
```python
class WhatsAppClient(ExampleAPIClient):
    def __init__(self):
        super().__init__(
            api_key=os.getenv('WHATSAPP_ACCESS_TOKEN'),
            base_url=f"https://graph.facebook.com/v19.0/{os.getenv('WHATSAPP_PHONE_NUMBER_ID')}",
            rate_limit=80
        )

    def send_text_message(self, to: str, body: str) -> APIResponse:
        """Send text message via WhatsApp"""
        return self.send_message(
            recipient=to,
            message=body,
            priority='normal'
        )

    def send_template_message(
        self,
        to: str,
        template_name: str,
        language: str = 'es'
    ) -> APIResponse:
        """Send pre-approved template message"""
        payload = {
            'messaging_product': 'whatsapp',
            'to': to,
            'type': 'template',
            'template': {
                'name': template_name,
                'language': {'code': language}
            }
        }

        if self.mock_mode:
            return APIResponse(success=True, message_id='mock_template')

        response_data = self._make_request('/messages', 'POST', payload)
        return APIResponse(
            success=True,
            message_id=response_data.get('messages', [{}])[0].get('id')
        )
```

### Example 2: Stripe Client
```python
class StripeClient(ExampleAPIClient):
    def __init__(self):
        super().__init__(
            api_key=os.getenv('STRIPE_SECRET_KEY'),
            base_url='https://api.stripe.com/v1',
            rate_limit=100
        )

    def create_payment_intent(
        self,
        amount: int,
        currency: str = 'eur',
        customer_id: str = None
    ) -> Dict[str, Any]:
        """Create payment intent"""
        payload = {
            'amount': amount,
            'currency': currency,
            'customer': customer_id
        }

        if self.mock_mode:
            return {'id': 'pi_mock_123', 'status': 'succeeded'}

        return self._make_request('/payment_intents', 'POST', payload)
```

### Example 3: SendGrid Client
```python
class SendGridClient(ExampleAPIClient):
    def __init__(self):
        super().__init__(
            api_key=os.getenv('SENDGRID_API_KEY'),
            base_url='https://api.sendgrid.com/v3',
            rate_limit=600  # SendGrid allows high rate
        )

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str
    ) -> APIResponse:
        """Send email via SendGrid"""
        payload = {
            'personalizations': [{'to': [{'email': to_email}]}],
            'from': {'email': os.getenv('SENDER_EMAIL')},
            'subject': subject,
            'content': [{'type': 'text/html', 'value': html_content}]
        }

        if self.mock_mode:
            return APIResponse(success=True, message_id='mock_email')

        response = self._make_request('/mail/send', 'POST', payload)
        return APIResponse(success=True, message_id=response.get('message_id'))
```

---

## Testing

```python
# tests/test_api_client.py
import pytest
from unittest.mock import patch, Mock
from shared.api_client_template import ExampleAPIClient, APIResponse

@pytest.fixture
def mock_client():
    """Client in mock mode"""
    return ExampleAPIClient(mock_mode=True)

@pytest.fixture
def real_client():
    """Client with mocked requests"""
    return ExampleAPIClient(
        api_key='test_key',
        mock_mode=False
    )

def test_mock_mode_doesnt_call_api(mock_client):
    """Verify mock mode doesn't make real API calls"""
    with patch('requests.request') as mock_request:
        response = mock_client.send_message('+34600', 'Test message')

        assert response.success
        assert response.message_id.startswith('mock_')
        mock_request.assert_not_called()  # No real API call

def test_retry_on_timeout(real_client):
    """Test that client retries on timeout"""
    with patch('requests.request') as mock_request:
        # First 2 calls timeout, 3rd succeeds
        mock_request.side_effect = [
            requests.Timeout(),
            requests.Timeout(),
            Mock(status_code=200, json=lambda: {'id': 'msg_123'})
        ]

        response = real_client.send_message('+34600', 'Test')

        assert response.success
        assert mock_request.call_count == 3  # Retried twice

def test_no_retry_on_400_error(real_client):
    """Test that client doesn't retry on client errors"""
    with patch('requests.request') as mock_request:
        mock_response = Mock(status_code=400)
        mock_response.raise_for_status.side_effect = requests.HTTPError()
        mock_request.return_value = mock_response

        with pytest.raises(requests.HTTPError):
            real_client.send_message('+34600', 'Test')

        assert mock_request.call_count == 1  # No retry

def test_rate_limiting(real_client):
    """Test rate limiting enforcement"""
    real_client.rate_limit = 2  # Very low limit for testing

    with patch('requests.request', return_value=Mock(status_code=200, json=lambda: {})):
        # First 2 calls should succeed
        real_client.send_message('+34600', 'Msg 1')
        real_client.send_message('+34600', 'Msg 2')

        # 3rd call should fail (rate limit)
        with pytest.raises(Exception, match='Rate limit exceeded'):
            real_client.send_message('+34600', 'Msg 3')
```

---

## Environment Variables

```bash
# .env.example
API_KEY=your_api_key_here
API_BASE_URL=https://api.example.com/v1
ENVIRONMENT=development  # Mock mode enabled
```

---

## Summary

This template provides:
- ✅ **Retry logic** - Handles transient failures automatically
- ✅ **Validation** - Pydantic ensures type safety
- ✅ **Mock mode** - Test without hitting real APIs or spending $$
- ✅ **Rate limiting** - Respect API limits
- ✅ **Logging** - Structured logs for observability
- ✅ **Error handling** - Distinguishes retryable vs permanent errors
- ✅ **Cost tracking** - Monitor expenses (optional)

**Copy this template for EVERY external API you integrate.**

---

## Quick Start Checklist

- [ ] Copy `api_client_template.py` to `shared/{service}_client.py`
- [ ] Update Pydantic models for your API
- [ ] Update base URL and auth headers
- [ ] Set rate limit for your API
- [ ] Write tests (mock mode + real mode)
- [ ] Add environment variables to `.env.example`
- [ ] Document API-specific quirks in comments
