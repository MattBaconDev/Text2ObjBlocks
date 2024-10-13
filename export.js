import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export function enableExportScene(button, app) {
	button.addEventListener('click', () => {
		const exporter = new STLExporter();
		const data = exporter.parse(app.scene);
		downloadFile(data);
	});
}

function downloadFile(data) {
	const blob = new Blob([data], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'scene.stl';
	link.click();
	URL.revokeObjectURL(url);
}
