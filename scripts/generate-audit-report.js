#!/usr/bin/env node

/**
 * Security Audit Report Generator
 * Generates detailed HTML/JSON reports from security audit
 */

const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(process.cwd(), '.tmp');
const MD_REPORT = path.join(REPORT_DIR, 'security_audit_report.md');
const HTML_REPORT = path.join(REPORT_DIR, 'security_audit_report.html');
const JSON_REPORT = path.join(REPORT_DIR, 'security_audit_report.json');

// Ensure report directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// Read markdown report
let mdContent = '';
if (fs.existsSync(MD_REPORT)) {
  mdContent = fs.readFileSync(MD_REPORT, 'utf8');
} else {
  console.error('❌ No audit report found. Run the security audit first:');
  console.error('   npm run audit:security');
  process.exit(1);
}

// Parse markdown to extract data
const parseReport = (markdown) => {
  const data = {
    date: '',
    project: '',
    criticalIssues: 0,
    highIssues: 0,
    mediumIssues: 0,
    lowIssues: 0,
    checksPassed: 0,
    score: 0,
    recommendation: '',
    details: markdown,
  };

  // Extract date
  const dateMatch = markdown.match(/\*\*Date:\*\* (.+)/);
  if (dateMatch) data.date = dateMatch[1];

  // Extract project name
  const projectMatch = markdown.match(/\*\*Project:\*\* (.+)/);
  if (projectMatch) data.project = projectMatch[1];

  // Extract issue counts
  const criticalMatch = markdown.match(/\*\*Critical Issues:\*\* (\d+)/);
  if (criticalMatch) data.criticalIssues = parseInt(criticalMatch[1]);

  const highMatch = markdown.match(/\*\*High Issues:\*\* (\d+)/);
  if (highMatch) data.highIssues = parseInt(highMatch[1]);

  const mediumMatch = markdown.match(/\*\*Medium Issues:\*\* (\d+)/);
  if (mediumMatch) data.mediumIssues = parseInt(mediumMatch[1]);

  const lowMatch = markdown.match(/\*\*Low Issues:\*\* (\d+)/);
  if (lowMatch) data.lowIssues = parseInt(lowMatch[1]);

  const passedMatch = markdown.match(/\*\*Checks Passed:\*\* (\d+)/);
  if (passedMatch) data.checksPassed = parseInt(passedMatch[1]);

  const scoreMatch = markdown.match(/\*\*Overall Score:\*\* (\d+)\/10/);
  if (scoreMatch) data.score = parseInt(scoreMatch[1]);

  // Extract recommendation
  const recMatch = markdown.match(/## Deployment Recommendation\s+\*\*(.+?)\*\*/);
  if (recMatch) data.recommendation = recMatch[1];

  return data;
};

const data = parseReport(mdContent);

// Generate HTML report
const generateHTML = (data) => {
  const getStatusColor = (score) => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    if (score >= 4) return '#f97316';
    return '#ef4444';
  };

  const getStatusEmoji = (score) => {
    if (score >= 8) return '✅';
    if (score >= 6) return '⚠️';
    return '⛔';
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Audit Report - ${data.project}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f9fafb;
            padding: 2rem;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .header h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .header p {
            opacity: 0.9;
            font-size: 0.95rem;
        }
        .score-section {
            padding: 2rem;
            text-align: center;
            background: #fafafa;
            border-bottom: 1px solid #e5e7eb;
        }
        .score-circle {
            width: 150px;
            height: 150px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: ${getStatusColor(data.score)};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 3rem;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .recommendation {
            font-size: 1.2rem;
            font-weight: 600;
            margin-top: 1rem;
        }
        .recommendation.block { color: #ef4444; }
        .recommendation.conditional { color: #eab308; }
        .recommendation.ready { color: #22c55e; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            padding: 2rem;
        }
        .stat-card {
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            background: #f9fafb;
            border: 2px solid #e5e7eb;
        }
        .stat-card.critical { border-color: #ef4444; background: #fef2f2; }
        .stat-card.high { border-color: #f97316; background: #fff7ed; }
        .stat-card.medium { border-color: #eab308; background: #fefce8; }
        .stat-card.passed { border-color: #22c55e; background: #f0fdf4; }
        .stat-number {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.25rem;
        }
        .stat-label {
            font-size: 0.875rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .details {
            padding: 2rem;
        }
        .details h2 {
            margin-top: 2rem;
            margin-bottom: 1rem;
            color: #1f2937;
        }
        .details ul {
            margin-left: 1.5rem;
            margin-bottom: 1rem;
        }
        .details li {
            margin-bottom: 0.5rem;
        }
        .footer {
            padding: 1.5rem 2rem;
            background: #fafafa;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
        }
        code {
            background: #f3f4f6;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.875rem;
        }
        pre {
            background: #1f2937;
            color: #f9fafb;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security Audit Report</h1>
            <p>${data.project} • ${data.date}</p>
        </div>

        <div class="score-section">
            <div class="score-circle">${getStatusEmoji(data.score)} ${data.score}/10</div>
            <div class="recommendation ${data.criticalIssues > 0 ? 'block' : data.highIssues > 0 ? 'conditional' : 'ready'}">
                ${data.recommendation || 'Report generated successfully'}
            </div>
        </div>

        <div class="stats">
            <div class="stat-card passed">
                <div class="stat-number">${data.checksPassed}</div>
                <div class="stat-label">Checks Passed</div>
            </div>
            <div class="stat-card critical">
                <div class="stat-number">${data.criticalIssues}</div>
                <div class="stat-label">Critical</div>
            </div>
            <div class="stat-card high">
                <div class="stat-number">${data.highIssues}</div>
                <div class="stat-label">High</div>
            </div>
            <div class="stat-card medium">
                <div class="stat-number">${data.mediumIssues}</div>
                <div class="stat-label">Medium</div>
            </div>
        </div>

        <div class="details">
            <h2>📋 Quick Actions</h2>
            ${data.criticalIssues > 0 ? '<p style="color: #ef4444; font-weight: 600;">⛔ Fix critical issues before deploying to production</p>' : ''}
            <ul>
                <li>Run <code>npm run audit:security</code> to re-run audit</li>
                <li>Check <code>.tmp/security_audit_report.md</code> for details</li>
                <li>Review <code>production-audit.md</code> for fix guidance</li>
            </ul>

            <h2>🎯 Priority Fixes</h2>
            ${data.criticalIssues > 0 ? `
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; margin-bottom: 1rem;">
                <strong>Critical Issues (${data.criticalIssues}):</strong> These MUST be fixed before deployment.
            </div>
            ` : ''}
            ${data.highIssues > 0 ? `
            <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 1rem; margin-bottom: 1rem;">
                <strong>High Priority (${data.highIssues}):</strong> Strongly recommended to fix before launch.
            </div>
            ` : ''}
            ${data.mediumIssues > 0 ? `
            <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 1rem;">
                <strong>Medium Priority (${data.mediumIssues}):</strong> Should be addressed soon.
            </div>
            ` : ''}
        </div>

        <div class="footer">
            Generated by Security Audit Script • ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
};

// Generate JSON report
const generateJSON = (data) => {
  return JSON.stringify({
    ...data,
    timestamp: new Date().toISOString(),
    totalIssues: data.criticalIssues + data.highIssues + data.mediumIssues + data.lowIssues,
    status: data.criticalIssues > 0 ? 'BLOCK' : data.highIssues > 0 ? 'WARNING' : 'PASS',
  }, null, 2);
};

// Write reports
try {
  const html = generateHTML(data);
  fs.writeFileSync(HTML_REPORT, html);
  console.log(`✅ HTML report saved to: ${HTML_REPORT}`);

  const json = generateJSON(data);
  fs.writeFileSync(JSON_REPORT, json);
  console.log(`✅ JSON report saved to: ${JSON_REPORT}`);

  console.log('');
  console.log(`📊 Security Score: ${data.score}/10`);
  console.log(`🔴 Critical: ${data.criticalIssues} | 🟡 High: ${data.highIssues} | 🟠 Medium: ${data.mediumIssues}`);
  console.log('');
  console.log(`Open the HTML report in your browser:`);
  console.log(`   file://${HTML_REPORT}`);

} catch (error) {
  console.error('❌ Error generating reports:', error.message);
  process.exit(1);
}
