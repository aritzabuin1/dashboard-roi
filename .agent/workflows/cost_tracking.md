---
description: Track costs of AI, APIs, and cloud services for ROI analysis
priority: MEDIUM
reusable: true
---

# Cost Tracking Workflow

**Know exactly how much your system costs to operate.**

## Purpose
Implement cost tracking for:
- ✅ AI/LLM API calls (OpenAI, Claude, etc)
- ✅ Paid APIs (WhatsApp, Twilio, Stripe, etc)
- ✅ Cloud resources (Azure Functions, Lambda, etc)
- ✅ Prompt Caching optimization
- ✅ ROI analysis

## When to Use
- ✅ ANY project using paid APIs
- ✅ Projects with LLM integration
- ✅ SaaS products (track unit economics)
- ✅ Serverless applications

---

## Implementation

### 1. Basic Cost Tracker
```python
# shared/cost_tracker.py
from datetime import datetime
import json
from pathlib import Path
from typing import Literal

class CostTracker:
    """Universal cost tracker for any paid service"""

    # Define cost rates (update as providers change pricing)
    COSTS = {
        # AI Models (per token)
        'claude-opus-4.5': {
            'input': 15.00 / 1_000_000,   # $15 per 1M tokens
            'output': 75.00 / 1_000_000,  # $75 per 1M tokens
            'cached': 1.50 / 1_000_000    # 90% discount with caching
        },
        'claude-sonnet-3.5': {
            'input': 3.00 / 1_000_000,
            'output': 15.00 / 1_000_000,
            'cached': 0.30 / 1_000_000
        },
        'gpt-4-turbo': {
            'input': 10.00 / 1_000_000,
            'output': 30.00 / 1_000_000,
            'cached': 0  # OpenAI doesn't have caching yet
        },
        'gpt-3.5-turbo': {
            'input': 0.50 / 1_000_000,
            'output': 1.50 / 1_000_000,
            'cached': 0
        },

        # APIs (per call/message)
        'whatsapp_message': 0.005,  # ~$0.005 per message
        'twilio_sms': 0.0079,       # ~$0.0079 per SMS
        'sendgrid_email': 0.0001,   # ~$0.0001 per email

        # Cloud (per execution)
        'azure_function': 0.0000002,  # ~$0.20 per 1M executions
        'aws_lambda': 0.0000002,
    }

    def __init__(self, log_file: str = '.tmp/costs.jsonl'):
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(exist_ok=True)

    def log_ai_call(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0,
        **metadata
    ) -> float:
        """
        Log AI/LLM API call and calculate cost

        Args:
            model: Model name (must be in COSTS dict)
            input_tokens: Input tokens used
            output_tokens: Output tokens generated
            cached_tokens: Tokens served from cache (Prompt Caching)
            **metadata: Additional context (user_id, request_id, etc)

        Returns:
            Total cost in USD
        """
        if model not in self.COSTS:
            raise ValueError(f"Unknown model: {model}. Add to COSTS dict.")

        rates = self.COSTS[model]

        # Calculate costs
        cost_input = input_tokens * rates['input']
        cost_output = output_tokens * rates['output']
        cost_cached = cached_tokens * rates['cached']
        total_cost = cost_input + cost_output + cost_cached

        # Calculate savings from caching
        savings = cached_tokens * (rates['input'] - rates['cached'])

        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'ai_call',
            'model': model,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens,
            'cached_tokens': cached_tokens,
            'total_tokens': input_tokens + output_tokens + cached_tokens,
            'cost_usd': round(total_cost, 6),
            'savings_from_cache': round(savings, 6),
            **metadata
        }

        self._write_event(event)
        return total_cost

    def log_api_call(
        self,
        service: str,
        count: int = 1,
        **metadata
    ) -> float:
        """
        Log paid API call (WhatsApp, SMS, Email, etc)

        Args:
            service: Service name (must be in COSTS dict)
            count: Number of calls/messages
            **metadata: Additional context

        Returns:
            Total cost in USD
        """
        if service not in self.COSTS:
            raise ValueError(f"Unknown service: {service}. Add to COSTS dict.")

        cost = self.COSTS[service] * count

        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'api_call',
            'service': service,
            'count': count,
            'cost_usd': round(cost, 6),
            **metadata
        }

        self._write_event(event)
        return cost

    def log_cloud_execution(
        self,
        platform: str,
        execution_count: int = 1,
        memory_mb: int = 128,
        duration_ms: int = 0,
        **metadata
    ) -> float:
        """
        Log cloud function execution (Azure Functions, Lambda, etc)

        Args:
            platform: 'azure_function' or 'aws_lambda'
            execution_count: Number of executions
            memory_mb: Memory allocated
            duration_ms: Execution duration
            **metadata: Additional context

        Returns:
            Total cost in USD
        """
        base_cost = self.COSTS.get(platform, 0) * execution_count

        # Azure Functions: Additional GB-s cost
        if platform == 'azure_function' and duration_ms > 0:
            gb_seconds = (memory_mb / 1024) * (duration_ms / 1000)
            gb_cost = gb_seconds * 0.000016  # $0.000016 per GB-s
            total_cost = base_cost + gb_cost
        else:
            total_cost = base_cost

        event = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'cloud_execution',
            'platform': platform,
            'execution_count': execution_count,
            'memory_mb': memory_mb,
            'duration_ms': duration_ms,
            'cost_usd': round(total_cost, 6),
            **metadata
        }

        self._write_event(event)
        return total_cost

    def _write_event(self, event: dict):
        """Write event to JSONL file"""
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(event) + '\n')

    def monthly_summary(self, year_month: str = None) -> dict:
        """
        Generate monthly cost summary

        Args:
            year_month: "2026-02" format. If None, uses current month.

        Returns:
            Dict with cost breakdown
        """
        if not self.log_file.exists():
            return {'total_cost': 0}

        import pandas as pd

        df = pd.read_json(self.log_file, lines=True)

        # Filter by month
        if year_month:
            df = df[df['timestamp'].str.startswith(year_month)]
        else:
            current_month = datetime.utcnow().strftime('%Y-%m')
            df = df[df['timestamp'].str.startswith(current_month)]

        if len(df) == 0:
            return {'total_cost': 0, 'period': year_month or current_month}

        summary = {
            'period': year_month or datetime.utcnow().strftime('%Y-%m'),
            'total_cost': df['cost_usd'].sum(),
            'breakdown': {}
        }

        # AI costs
        ai_df = df[df['type'] == 'ai_call']
        if len(ai_df) > 0:
            summary['breakdown']['ai'] = {
                'total_cost': ai_df['cost_usd'].sum(),
                'total_tokens': ai_df['total_tokens'].sum(),
                'savings_from_cache': ai_df['savings_from_cache'].sum(),
                'by_model': ai_df.groupby('model')['cost_usd'].sum().to_dict(),
                'call_count': len(ai_df)
            }

        # API costs
        api_df = df[df['type'] == 'api_call']
        if len(api_df) > 0:
            summary['breakdown']['api'] = {
                'total_cost': api_df['cost_usd'].sum(),
                'by_service': api_df.groupby('service')['cost_usd'].sum().to_dict(),
                'call_count': api_df['count'].sum()
            }

        # Cloud costs
        cloud_df = df[df['type'] == 'cloud_execution']
        if len(cloud_df) > 0:
            summary['breakdown']['cloud'] = {
                'total_cost': cloud_df['cost_usd'].sum(),
                'execution_count': cloud_df['execution_count'].sum(),
                'by_platform': cloud_df.groupby('platform')['cost_usd'].sum().to_dict()
            }

        return summary


# Usage
tracker = CostTracker()

# Log AI call
tracker.log_ai_call(
    model='claude-opus-4.5',
    input_tokens=1500,
    output_tokens=300,
    cached_tokens=1200,  # Prompt Caching saves $$$
    user_id='user_123',
    request_id='req_456'
)

# Log WhatsApp message
tracker.log_api_call(
    service='whatsapp_message',
    count=1,
    recipient='+34XXX',
    message_type='alert'
)

# Get monthly summary
summary = tracker.monthly_summary('2026-02')
print(f"Total cost: ${summary['total_cost']:.2f}")
print(f"AI savings from cache: ${summary['breakdown']['ai']['savings_from_cache']:.2f}")
```

---

### 2. Integration with AI Calls (Claude)
```python
import anthropic
from shared.cost_tracker import CostTracker

tracker = CostTracker()

def generate_summary_with_cost_tracking(data: dict) -> str:
    """Generate AI summary and track costs"""

    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    # System prompt (cacheable to save 90% on repeated calls)
    system_prompt = """You are an expert in coffee shop analytics.
    Generate concise, actionable summaries for cafe owners."""

    response = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=300,
        system=[{
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"}  # Enable Prompt Caching
        }],
        messages=[{
            "role": "user",
            "content": f"Summarize this data: {data}"
        }]
    )

    # Track cost
    tracker.log_ai_call(
        model='claude-opus-4.5',
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        cached_tokens=response.usage.cache_read_input_tokens,
        operation='generate_summary',
        data_size=len(str(data))
    )

    return response.content[0].text
```

**Prompt Caching savings:**
- First call: ~1500 input tokens × $0.000015 = **$0.0225**
- Cached call: 1200 cached tokens × $0.0000015 = **$0.0018** (92% cheaper!)

---

### 3. Daily Cost Alert
```python
def check_daily_budget_and_alert(budget_usd: float = 10.0):
    """Alert if daily costs exceed budget"""
    tracker = CostTracker()

    today = datetime.utcnow().strftime('%Y-%m-%d')
    daily_cost = tracker.daily_summary(today)['total_cost']

    if daily_cost > budget_usd:
        # Send alert (email, Slack, etc)
        send_alert(
            f"⚠️ Daily budget exceeded: ${daily_cost:.2f} / ${budget_usd:.2f}",
            severity='warning'
        )

    return daily_cost
```

---

### 4. Cost Dashboard (Streamlit)
```python
# dashboard/cost_dashboard.py
import streamlit as st
import pandas as pd
from shared.cost_tracker import CostTracker

st.title("💰 Cost Dashboard")

tracker = CostTracker()
summary = tracker.monthly_summary()

# KPIs
col1, col2, col3 = st.columns(3)
col1.metric("Total Cost", f"${summary['total_cost']:.2f}")
col2.metric("AI Calls", summary['breakdown']['ai']['call_count'])
col3.metric("Cache Savings", f"${summary['breakdown']['ai']['savings_from_cache']:.2f}")

# Cost by service
st.subheader("Cost Breakdown")
df = pd.DataFrame([
    {'Service': 'AI', 'Cost': summary['breakdown']['ai']['total_cost']},
    {'Service': 'API', 'Cost': summary['breakdown']['api']['total_cost']},
    {'Service': 'Cloud', 'Cost': summary['breakdown']['cloud']['total_cost']}
])
st.bar_chart(df.set_index('Service'))

# Cost over time
st.subheader("Cost Trend")
# Load full log and plot daily costs
df_log = pd.read_json('.tmp/costs.jsonl', lines=True)
df_log['date'] = pd.to_datetime(df_log['timestamp']).dt.date
daily_costs = df_log.groupby('date')['cost_usd'].sum()
st.line_chart(daily_costs)
```

Run: `streamlit run dashboard/cost_dashboard.py`

---

### 5. ROI Calculator
```python
def calculate_roi(period: str = '2026-02'):
    """Calculate ROI of the system"""
    tracker = CostTracker()
    summary = tracker.monthly_summary(period)

    # Costs
    total_cost = summary['total_cost']

    # Benefits (example for Cafes Cornella)
    # Assuming 500 alerts prevented downtime = 500 cups saved = 500 * €2.50 margin
    alerts_sent = 500  # Get from logs
    cups_saved = alerts_sent * 0.5  # 50% of alerts prevent issues
    revenue_saved = cups_saved * 2.50  # €2.50 margin per cup

    # ROI
    roi = (revenue_saved - total_cost) / total_cost * 100

    return {
        'period': period,
        'total_cost': total_cost,
        'revenue_saved': revenue_saved,
        'net_benefit': revenue_saved - total_cost,
        'roi_percentage': roi
    }

roi = calculate_roi('2026-02')
print(f"ROI: {roi['roi_percentage']:.1f}% (${roi['net_benefit']:.2f} net benefit)")
```

---

### 6. Optimization Strategies

#### A) Prompt Caching (90% savings)
```python
# BEFORE (expensive)
response = client.messages.create(
    model="claude-opus-4-5",
    system="Long system prompt here...",  # Charged every time
    messages=[{"role": "user", "content": user_input}]
)
# Cost: $0.0225 per call

# AFTER (with caching)
response = client.messages.create(
    model="claude-opus-4-5",
    system=[{
        "type": "text",
        "text": "Long system prompt here...",
        "cache_control": {"type": "ephemeral"}  # Cache this!
    }],
    messages=[{"role": "user", "content": user_input}]
)
# First call: $0.0225
# Subsequent calls: $0.0018 (92% cheaper!)
```

#### B) Model Selection
```python
# Use cheaper models for simple tasks
def choose_model_by_complexity(task_complexity: str):
    if task_complexity == 'simple':
        return 'gpt-3.5-turbo'  # $0.50 per 1M tokens
    elif task_complexity == 'medium':
        return 'claude-sonnet-3.5'  # $3 per 1M tokens
    else:
        return 'claude-opus-4.5'  # $15 per 1M tokens
```

#### C) Batch Processing
```python
# EXPENSIVE: 100 separate API calls
for item in items:
    result = api_call(item)  # $0.005 × 100 = $0.50

# CHEAP: 1 batch API call
results = batch_api_call(items)  # $0.01 (if batch endpoint exists)
```

---

### 7. Unit Economics Tracking
```python
def calculate_unit_economics(month: str):
    """Calculate cost per user/customer"""
    tracker = CostTracker()
    summary = tracker.monthly_summary(month)

    # Get business metrics (from your analytics)
    active_users = 150  # Cafes using the system
    alerts_sent = 2000
    reports_sent = 600

    return {
        'cost_per_user': summary['total_cost'] / active_users,
        'cost_per_alert': summary['total_cost'] / alerts_sent,
        'cost_per_report': summary['total_cost'] / reports_sent
    }

# Example output:
# {'cost_per_user': 0.20, 'cost_per_alert': 0.015, 'cost_per_report': 0.05}
# = $0.20 per cafe per month (very affordable!)
```

---

### 8. Budget Enforcement
```python
class BudgetEnforcer:
    """Stop operations if budget exceeded"""

    def __init__(self, daily_limit: float = 50.0):
        self.daily_limit = daily_limit
        self.tracker = CostTracker()

    def check_budget(self) -> bool:
        """Returns True if budget OK, False if exceeded"""
        today = datetime.utcnow().strftime('%Y-%m-%d')
        daily_summary = self.tracker.monthly_summary(today[:7])  # Current month

        # Calculate today's spending
        df = pd.read_json(self.tracker.log_file, lines=True)
        df = df[df['timestamp'].str.startswith(today)]
        today_cost = df['cost_usd'].sum()

        if today_cost > self.daily_limit:
            logging.critical(f"Daily budget exceeded: ${today_cost:.2f} / ${self.daily_limit:.2f}")
            return False

        return True

# Usage
enforcer = BudgetEnforcer(daily_limit=50.0)

if not enforcer.check_budget():
    raise Exception("Daily budget exceeded. Stopping operations.")

# ... proceed with expensive operations ...
```

---

### 9. Testing Cost Tracking
```python
import pytest
from shared.cost_tracker import CostTracker
import tempfile

@pytest.fixture
def tracker():
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.jsonl') as f:
        return CostTracker(log_file=f.name)

def test_ai_call_cost_calculation(tracker):
    """Test AI cost calculation"""
    cost = tracker.log_ai_call(
        model='claude-opus-4.5',
        input_tokens=1000,
        output_tokens=200,
        cached_tokens=0
    )

    # 1000 * 0.000015 + 200 * 0.000075 = 0.015 + 0.015 = $0.03
    assert cost == pytest.approx(0.03, rel=0.01)

def test_prompt_caching_savings(tracker):
    """Test caching reduces cost"""
    # Without caching
    cost_no_cache = tracker.log_ai_call(
        model='claude-opus-4.5',
        input_tokens=2000,
        output_tokens=100,
        cached_tokens=0
    )

    # With caching (same tokens, but 1800 cached)
    cost_with_cache = tracker.log_ai_call(
        model='claude-opus-4.5',
        input_tokens=200,
        output_tokens=100,
        cached_tokens=1800
    )

    # Cached should be ~90% cheaper on input tokens
    assert cost_with_cache < cost_no_cache * 0.2

def test_monthly_summary(tracker):
    """Test summary generation"""
    tracker.log_ai_call('claude-opus-4.5', 1000, 200, 0)
    tracker.log_api_call('whatsapp_message', count=5)

    summary = tracker.monthly_summary()

    assert summary['total_cost'] > 0
    assert 'ai' in summary['breakdown']
    assert 'api' in summary['breakdown']
```

---

## Summary
- ✅ Track ALL paid services (AI, APIs, cloud)
- ✅ Use Prompt Caching to save 90% on AI costs
- ✅ Calculate ROI to justify the system
- ✅ Set daily/monthly budgets and alerts
- ✅ Choose cheaper models for simple tasks
- ✅ Monitor unit economics (cost per user)

**Expected costs for Cafes Cornella (150 cafes):**
- AI: ~$15/month (with caching)
- WhatsApp: ~$10/month (2000 messages × $0.005)
- Azure Functions: ~$5/month
- **Total: ~$30/month = $0.20 per cafe** ✅ Very affordable!

**Copy this to ANY project with paid APIs to avoid cost surprises.**
