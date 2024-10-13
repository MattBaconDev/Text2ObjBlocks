import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export function enableExportScene(button, app) {
	button.addEventListener('click', async () => {
		const exporter = new STLExporter();
		const oldRot = app.scene.rotation.clone();
		const oldPos = app.scene.position.clone();
		app.scene.rotation.set(0, 0, 0);
		app.scene.position.set(0, 0, 0);
		await app.render();
		setTimeout(() => {
			const data = exporter.parse(app.scene);
			downloadFile(data, app.getSceneName());
			setTimeout(() => {
				app.scene.rotation.set(oldRot.x, oldRot.y, oldRot.z);
				app.scene.position.set(oldPos.x, oldPos.y, oldPos.z);
			}, 50);
		}, 50);
	});
}

function downloadFile(data, name) {
	const blob = new Blob([data], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = name || 'scene.stl';
	link.click();
	URL.revokeObjectURL(url);
}
