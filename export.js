import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export function enableExportScene(button, app) {
	button.addEventListener('click', async () => {
		exportScene(app);
	});
}

export function exportScene(app) {
	const exporter = new STLExporter();
	const data = exporter.parse(app.svgGroup);
	downloadFile(data, app.getSceneName());
}

function downloadFile(data, name) {
	const blob = new Blob([data], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = name ? name + '.stl' : 'scene.stl';
	link.click();
	URL.revokeObjectURL(url);
}
