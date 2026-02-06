import { createFileRoute } from "@tanstack/react-router";
import { useAppContext } from "../../contexts/app-context";

export const Route = createFileRoute("/overview/")({
	component: OverviewPage,
	staticData: {
		tabLabel: "Overviewsfggghhhjhzzzd",
		tabOrder: 1,
	},
});

function OverviewPage() {
	const { status } = useAppContext();
	const nextSteps = status.isConnected
		? [
			"Open issues from the Explorer tree to see details in the Jira tab.",
			"Tune JQL and max results from the Settings tab.",
			"Use the Dev tab when working on the webview UI or extension host.",
		]
		: [
			"Open the Setup tab to add your Jira URL, email, and API token.",
			"Store secrets in .env.local when you want per-workspace credentials.",
			"After connecting, use the Settings tab to tune JQL and max results.",
		];

	return (
		<section className="grid">
			<div className="card">
				<div className="card-header">
					<div>
						<div className="eyebrow">Worgffkflosdfw</div>
						<h2>What to do next</h2>
						<p className="card-sub">A quick path to get value from the extension.</p>
					</div>
				</div>
				<ul className="list">
					{nextSteps.map((step) => (
						<li key={step}>{step}</li>
					))}
				</ul>
				<p className="note">
					The primary action always lives in the top header. Use tabs for deeper configuration.
				</p>
			</div>
		</section>
	);
}
