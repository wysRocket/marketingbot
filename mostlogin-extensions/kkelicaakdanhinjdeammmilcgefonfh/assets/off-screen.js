chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action == 'getScreen') {
		sendResponse({
			width: screen.availWidth,
			height: screen.availHeight,
			left: screen.availLeft,
			top: screen.availTop,
		})
	}

	if (request.action == 'getIcons') {
		getIcons(request.data).then(sendResponse)
	}

	return true
})

async function getIcons({ svg, light }) {
	const file = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
	const data = URL.createObjectURL(file)

	const icons = await Promise.all([svg2ImgData(data, 16, light, 1), svg2ImgData(data, 32, light, 2)])

	return icons
}

function svg2ImgData(source, size, light, scale = 1) {
	return new Promise((resolve, reject) => {
		const cnv = document.createElement('canvas')
		const ctx = cnv.getContext('2d')
		const img = document.createElement('img')

		cnv.width = size
		cnv.height = size

		img.width = size
		img.height = size

		img.onload = _render
		img.src = source

		function _render() {
			let shadow = light ? `rgba(255, 255, 255, ${0.075 * scale})` : `rgba(0, 0, 0, ${0.05 * scale})`

			ctx.shadowColor = shadow
			ctx.shadowBlur = 1
			ctx.shadowOffsetX = 0
			ctx.shadowOffsetY = 1
			ctx.drawImage(img, 0, 0)

			const image = ctx.getImageData(0, 0, size, size)
			const response = {
				data: Array.from(image.data),
				width: image.width,
				height: image.height,
				colorSpace: image.colorSpace,
			}

			resolve(response)
		}
	})
}
