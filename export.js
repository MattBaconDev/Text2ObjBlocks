import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

export function enableExportScene(button, app) {
	button.addEventListener('click', () => {
		const exporter = new OBJExporter();
		const data = exporter.parse(app.scene);
		downloadFile(data);
	});
}

function downloadFile(data) {
	const blob = new Blob([data], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'scene.obj';
	link.click();
	URL.revokeObjectURL(url);
}
