"""
Claude AI validation service.
Bundles portfolio state + recommendations and sends to Claude for CRA compliance review.
"""

import anthropic
from ..config import settings


SYSTEM_PROMPT = """You are a Canadian financial planning advisor with deep expertise in:
- Canada Revenue Agency (CRA) tax rules and regulations
- TFSA, RRSP, FHSA, LIRA, and non-registered account rules
- Capital gains, ACB calculations, and loss harvesting under the Income Tax Act
- Ontario provincial tax
- EI maternity/parental benefits
- First Home Savings Account (FHSA) rules and FHSA home withdrawal conditions
- Margin account interest deductibility under ITA s.20(1)(c)
- Superficial loss rules (ITA s.54)
- LIRA withdrawal restrictions by province

Always cite specific CRA rules, IT bulletins, or ITA sections when relevant.
Flag any compliance risks clearly. Be specific about amounts and dates.
If a strategy has risks, explain them and suggest safer alternatives.
Format your response with clear sections: Summary, Findings, Risks, Recommendations."""


def ask_claude(prompt: str, context: dict | None = None) -> str:
    """Send a financial planning question to Claude and return the response."""
    if not settings.anthropic_api_key:
        return "⚠️ Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env file."

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    full_prompt = prompt
    if context:
        import json
        full_prompt = f"Portfolio Context:\n```json\n{json.dumps(context, indent=2, default=str)}\n```\n\nQuestion: {prompt}"

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": full_prompt}],
    )

    return message.content[0].text


def validate_tax_strategy(strategy: dict) -> str:
    """Validate a specific tax strategy against CRA rules."""
    prompt = f"""Please review this financial strategy for CRA compliance and tax optimization:

Strategy: {strategy.get('name', 'Unnamed')}
Description: {strategy.get('description', '')}

Actions planned:
{chr(10).join(f'- {a}' for a in strategy.get('actions', []))}

Please check:
1. CRA compliance for each action
2. Optimal sequencing of actions
3. Any superficial loss, attribution, or other rule violations
4. Tax optimization opportunities missed
5. Impact on contribution room (TFSA, RRSP, FHSA)"""

    return ask_claude(prompt, context=strategy)


def get_loss_harvest_advice(holding: dict, portfolio: dict) -> str:
    """Get specific advice on harvesting a capital loss position."""
    prompt = f"""Analyze this capital loss harvesting opportunity for a Canadian investor (Ontario):

Position: {holding.get('symbol')} — {holding.get('name')}
Book Value (ACB): ${holding.get('book_value_cad', 0):,.2f} CAD
Current Market Value: ${holding.get('market_value_cad', 0):,.2f} CAD
Unrealized Loss: ${abs(holding.get('unrealized_loss', 0)):,.2f} CAD
Account Type: {holding.get('account_type', 'Non-registered margin')}
Other gains realized YTD: ${portfolio.get('ytd_gains', 0):,.2f} CAD

Please advise:
1. Should we harvest this loss now?
2. Superficial loss rule implications (30-day window)
3. What replacement ETF could be purchased to maintain market exposure?
4. 3-year capital loss carryback vs carryforward options
5. Optimal timing relative to year-end"""

    return ask_claude(prompt)


def get_fhsa_strategy(sean: dict, saudya: dict) -> str:
    """Get FHSA withdrawal strategy for first home purchase."""
    prompt = f"""Advise on optimal FHSA withdrawal strategy for a home purchase:

Sean (Ontario):
- FHSA balance: ${sean.get('fhsa_balance', 0):,.2f} CAD
- FHSA contributions to date: ${sean.get('fhsa_contributed', 0):,.2f}
- RRSP balance: ${sean.get('rrsp_balance', 0):,.2f}
- First time home buyer: Yes

Saudya (Ontario):
- FHSA balance: ${saudya.get('fhsa_balance', 0):,.2f} CAD
- FHSA contributions to date: ${saudya.get('fhsa_contributed', 0):,.2f}
- RRSP balance: ${saudya.get('rrsp_balance', 0):,.2f}
- First time home buyer: Yes

Target home price: ${sean.get('house_price', 900000):,.0f}
Target purchase year: {sean.get('house_year', 2030)}

Please advise on:
1. FHSA qualifying withdrawal rules and conditions
2. RRSP Home Buyers' Plan ($35K each) — should they use this too?
3. Optimal combination of FHSA + HBP + other savings
4. Tax implications and repayment requirements for HBP
5. Timing of final FHSA contributions before withdrawal"""

    return ask_claude(prompt)


def annual_review_prompt(year: int, sean_income: dict, saudya_income: dict, portfolio: dict) -> str:
    """Generate a comprehensive year-end review and recommendations."""
    prompt = f"""Year-end financial review for a Canadian couple (Ontario) for tax year {year}:

SEAN:
- Employment income: ${sean_income.get('base', 0):,.0f}
- Bonus: ${sean_income.get('bonus', 0):,.0f}
- RRSP room available: ${sean_income.get('rrsp_room', 0):,.0f}
- TFSA room available: ${sean_income.get('tfsa_room', 0):,.0f}
- FHSA room available: ${sean_income.get('fhsa_room', 0):,.0f}
- RRSP balance: ${sean_income.get('rrsp_balance', 0):,.0f}
- TFSA balance: ${sean_income.get('tfsa_balance', 0):,.0f}
- Marginal rate estimate: ~{sean_income.get('marginal_rate', 53)}%

SAUDYA:
- Employment income: ${saudya_income.get('base', 0):,.0f}
- Bonus: ${saudya_income.get('bonus', 0):,.0f}
- RRSP room available: ${saudya_income.get('rrsp_room', 0):,.0f}
- TFSA room available: ${saudya_income.get('tfsa_room', 0):,.0f}
- FHSA room available: ${saudya_income.get('fhsa_room', 0):,.0f}
- RRSP balance: ${saudya_income.get('rrsp_balance', 0):,.0f}
- TFSA balance: ${saudya_income.get('tfsa_balance', 0):,.0f}

PORTFOLIO:
- Unrealized losses (non-registered): ${portfolio.get('unrealized_losses', 0):,.0f}
- Unrealized gains (non-registered): ${portfolio.get('unrealized_gains', 0):,.0f}
- YTD realized gains: ${portfolio.get('ytd_gains', 0):,.0f}
- Margin loan (Sean): ${portfolio.get('sean_margin_loan', 100000):,.0f} @ {portfolio.get('margin_rate', 3.95)}%
- Margin loan (Saudya): ${portfolio.get('saudya_margin_loan', 100000):,.0f} @ {portfolio.get('margin_rate', 3.95)}%

Provide year-end action checklist with priority and estimated tax savings for each item."""

    return ask_claude(prompt)
