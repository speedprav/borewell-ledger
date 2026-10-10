// pages/AboutPage.tsx
import { ExternalLink, AlertCircle } from 'lucide-react'

export function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">About Borewell Ledger</h1>

      {/* Mission */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-[#0B5C8A] dark:text-blue-400">Mission</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Borewell Ledger is a community groundwater early-warning platform for India.
          It helps housing societies, farmers, water officers and NGOs track borewell water levels,
          compare with nearby wells, and receive early warnings before wells run dry.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Built for the <strong>WeMakeDevs × AWS Environmental Hackathon 2024</strong> under
          the <em>Heat and Water (Groundwater)</em> track.
        </p>
      </div>

      {/* How it works */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Log → Compare → Act</h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong>Decline Rate</strong> is computed as the ordinary least-squares slope of depth over time
            (meters per month). A positive value means the water table is falling (getting deeper).
            Computed from the last 90 days, needs at least 3 readings spanning 14+ days.
          </p>
          <p>
            <strong>Peer Comparison</strong> uses wells within 3 km radius. Peer median is the median
            slope of at least 3 neighboring wells. If your well declines significantly faster than peers,
            it may indicate over-extraction.
          </p>
          <p>
            <strong>Status thresholds</strong> (these are starting values, labeled as assumptions):
          </p>
          <ul className="pl-4 space-y-1">
            <li><span className="text-red-600 font-medium">Critical</span>: slope ≥ 0.8 m/mo AND ≥ 2.5× peer median</li>
            <li><span className="text-amber-600 font-medium">Watch</span>: slope ≥ 0.3 m/mo AND ≥ 1.5× peer median</li>
            <li><span className="text-green-600 font-medium">Normal</span>: all other cases with enough data</li>
          </ul>
        </div>
      </div>

      {/* Data sources */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">Data Sources</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b">
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Source</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50 dark:border-gray-700/50">
              <td className="px-4 py-2 font-medium">Community readings</td>
              <td className="px-4 py-2"><span className="text-green-600 font-medium">Active</span></td>
              <td className="px-4 py-2 text-gray-500">User-submitted borewell readings</td>
            </tr>
            <tr className="border-b border-gray-50 dark:border-gray-700/50">
              <td className="px-4 py-2 font-medium">Demo data (Vadodara)</td>
              <td className="px-4 py-2"><span className="text-blue-600 font-medium">Simulated</span></td>
              <td className="px-4 py-2 text-gray-500">40 synthetic wells for demonstration. Clearly labeled.</td>
            </tr>
            <tr className="border-b border-gray-50 dark:border-gray-700/50">
              <td className="px-4 py-2 font-medium">CGWB benchmark</td>
              <td className="px-4 py-2"><span className="text-gray-400 font-medium">Not integrated</span></td>
              <td className="px-4 py-2 text-gray-500">Official data on roadmap</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Limitations */}
      <div className="card border-amber-200 dark:border-amber-700 p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertCircle size={16} />
          <h2 className="font-semibold">Limitations</h2>
        </div>
        <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 pl-4 list-disc">
          <li>Status thresholds are starting assumptions — will need community calibration.</li>
          <li>Peer comparison requires at least 3 wells within 3 km.</li>
          <li>AI analysis is for guidance only. Not a substitute for professional hydrogeology advice.</li>
          <li>Demo data is entirely simulated and does not represent real readings.</li>
          <li>No official data integration yet (CGWB, etc.).</li>
        </ul>
      </div>

      {/* AWS Architecture */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">AWS Architecture</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          {[
            ['S3 + CloudFront', 'Static frontend hosting with OAC, HTTPS, price class 100'],
            ['API Gateway (HTTP API)', 'CORS-secured REST API, per-route throttling'],
            ['AWS Lambda (Python 3.12)', 'All compute — arm64, on-demand, no idle billing'],
            ['DynamoDB (on-demand)', '4 tables: Wells, Readings, Alerts, Meta (TTL enabled)'],
            ['EventBridge ScheduleV2', 'Daily analyzer run (rate(1 day))'],
            ['SNS', 'Email alerts for Critical and Area-wide events'],
            ['Amazon Bedrock', 'Converse API for AI analysis, plan and chat'],
            ['AWS SAM', 'Open-source IaC — full stack in template.yaml'],
            ['AWS Budgets', 'Cost guard at $5/month with alerts at 50/80/100%'],
          ].map(([service, desc]) => (
            <div key={service} className="flex gap-2">
              <span className="font-medium shrink-0 w-36 text-[#0B5C8A] dark:text-blue-400">{service}</span>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Roadmap</h2>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>📡 IoT sensor integration for automated readings</li>
          <li>💬 WhatsApp input (no smartphone needed)</li>
          <li>🌧️ Rainfall correlation with water level trends</li>
          <li>🏛️ Authority dashboard for government water officers</li>
          <li>📊 CGWB official data integration</li>
        </ul>
      </div>

      {/* Team */}
      <div className="card p-4 text-center space-y-2">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Team</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Built by <strong>Devtwin</strong>
        </p>
        <a
          href="https://github.com/speedprav/borewell-ledger"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#0B5C8A] hover:underline"
        >
          <ExternalLink size={14} />
          View on GitHub
        </a>
        <p className="text-xs text-gray-400 mt-2">
          AI coding tools used: IBM Bob (Claude Sonnet), GitHub Copilot
        </p>
      </div>
    </div>
  )
}
