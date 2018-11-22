var url = require('url');

module.exports = processor;

function processor (harClean, harCache) {

	// ищем важное в харах
	var data = getData(harClean);
	var dataCache = getData(harCache);

	return {

		// время
		server_time: data.time.server,
		dom_content_load: data.time.DOMContentLoaded,
		onload: data.time.load,
		finish_time: data.time.finish,

		// всего загружено
		total_download_own: data.data.total.size - data.data.third.size,
		total_download_third: data.data.third.size,
		
		// загрузка до событий
		dom_content_load_download: data.data.total.onContentLoadTransfer,
		onload_download: data.data.total.onLoadTransfer,
		finish_download: data.data.total.sizeTransfer - data.data.total.onContentLoadTransfer - data.data.total.onLoadTransfer,

		// всего запросов
		total_entries_own: data.data.total.entries.length - data.data.third.entries.length,
		total_entries_third: data.data.third.entries.length,

		// размер документа
		document_size: data.data.documentSize,

		// размер стилей
		style_size_own: data.data.styles.size - data.data.third.styles.size,
		style_size_third: data.data.third.styles.size,

		// запросы стилей
		style_count_own: data.data.styles.entries.length - data.data.third.styles.entries.length,
		style_count_third: data.data.third.styles.entries.length,

		// размер скриптов
		script_size_own: data.data.scripts.size - data.data.third.scripts.size,
		script_size_third: data.data.third.scripts.size,

		// запросы скриптов
		script_count_own: data.data.scripts.entries.length - data.data.third.scripts.entries.length,
		script_count_third: data.data.third.scripts.entries.length,

		// размер изображений
		size_img_own: data.data.images.size - data.data.third.images.size,
		size_img_third: data.data.third.images.size,

		// запросы изображений
		count_img_own: data.data.images.entries.length - data.data.third.images.entries.length,
		count_img_third: data.data.third.images.entries.length,

		// время c кешем
		dom_content_load_cache: dataCache.time.DOMContentLoaded,
		onload_cache: dataCache.time.load,
		finish_time_cache: dataCache.time.finish,

		// размер с кешем
		total_download_cache: dataCache.data.total.sizeTransfer,

		// загрузка до событий
		dom_content_load_download_cache: dataCache.data.total.onContentLoadTransfer,
		onload_download_cache: dataCache.data.total.onLoadTransfer,
		finish_download_cache: dataCache.data.total.sizeTransfer - dataCache.data.total.onContentLoadTransfer - dataCache.data.total.onLoadTransfer
	};
};

function getData (har) {
	var data = har.log;

	var total = 0;
	var totalThird = 0;
	var totalTransfer = 0;

	var totalTransferOnContentLoad = 0;
	var totalTransferOnLoad = 0;

	var totalImg = 0;
	var totalImgThird = 0;

	var totalJpg = 0;
	var totalPng = 0;
	var totalGif = 0;

	var totalStyle = 0;
	var totalStyleThird = 0;

	var totalScript = 0;
	var totalScriptThird = 0;

	var styles = [];
	var stylesThird = [];

	var scripts = [];
	var scriptsThird = [];

	var images = [];
	var imagesThird = [];

	var third = [];

	var currentPath = url.parse(data.pages[0].title);
	var basePath = '://'+ currentPath.host;

	var start = new Date(data.pages[0].startedDateTime).getTime();
	var uniqEntry = [];
	var finish = 0;

	data.entries.forEach(function (entry) {
		var sizeEncoded = getEncodedSize(entry);
		var sizeTransfer = getTransferSize(entry);
		var sizeDecoded = entry.response.content.size;

		total += sizeEncoded;
		totalTransfer += sizeTransfer;

		// работаем с уникальными запросами
		if (uniqEntry.indexOf(entry.request.url) === -1) {

			if (
				new Date(entry.startedDateTime).getTime() - start + entry.time < data.pages[0].pageTimings.onContentLoad
			) {
				totalTransferOnContentLoad += sizeTransfer;
			}
			else if (
				new Date(entry.startedDateTime).getTime() - start + entry.time < data.pages[0].pageTimings.onLoad
			) {
				totalTransferOnLoad += sizeTransfer;
			};

			// увеличиваем время до окончания загрузки
			if (finish < new Date(entry.startedDateTime).getTime() - start + entry.time) {
				uniqEntry.push(entry.request.url);
				finish = new Date(entry.startedDateTime).getTime() - start + entry.time;
			};
		};

		if (entry.response.content.mimeType.match(/image.*/)) {
			images.push(entry);
			totalImg += sizeEncoded;

			if (entry.response.content.mimeType.match(/jpeg/)) {
				totalJpg += sizeEncoded;
			}
			else if (entry.response.content.mimeType.match(/png/)) {
				totalPng += sizeEncoded;
			}
			else if (entry.response.content.mimeType.match(/gif/)) {
				totalGif += sizeEncoded;
			};

			if (!entry.request.url.match(basePath)) {
				imagesThird.push(entry);
				totalImgThird += sizeEncoded;
			};
		}
		else if (entry.response.content.mimeType.match(/script/)) {
			scripts.push(entry)
			totalScript += sizeEncoded;

			if (!entry.request.url.match(basePath)) {
				scriptsThird.push(entry);
				totalScriptThird += sizeEncoded;
			};
		}
		else if (entry.response.content.mimeType.match(/css/)) {
			styles.push(entry)
			totalStyle += sizeEncoded;

			if (!entry.request.url.match(basePath)) {
				stylesThird.push(entry);
				totalStyleThird += sizeEncoded;
			};
		};

		if (!entry.request.url.match(basePath)) {
			totalThird += sizeEncoded;
			third.push(entry);
		};
	});

	return {

		// весь лог
		_log: data,

		// время
		time: {

			// ответ сервера
			server: Math.round(data.entries[0].time),

			// готовность документа
			DOMContentLoaded: Math.round(data.pages[0].pageTimings.onContentLoad),

			// загрузка документа
			load: Math.round(data.pages[0].pageTimings.onLoad),

			// окончание загрузки
			finish: Math.round(finish)
		},

		// данные
		data: {

			// всего
			total: {

				// размер
				size: total,

				// размер переданный
				sizeTransfer: totalTransfer,

				// переданный до onContentLoad
				onContentLoadTransfer: totalTransferOnContentLoad,

				// переданный до onLoad
				onLoadTransfer: totalTransferOnLoad,

				// запросы
				entries: data.entries
			},

			// размер документа
			documentSize: getEncodedSize(data.entries[0]),

			// стили
			styles: {
				size: totalStyle,
				entries: styles
			},

			// скрипты
			scripts: {
				size: totalScript,
				entries: scripts
			},

			// изображения
			images: {
				size: totalImg,
				entries: images,
				jpeg: {
					size: totalJpg,
					relativeSize: totalJpg / totalImg * 100
				},
				png: {
					size: totalPng,
					relativeSize: totalPng / totalImg * 100
				},
				gif: {
					size: totalGif,
					relativeSize: totalGif / totalImg * 100
				}
			},

			// левейшие ресурсы
			third: {
				size: totalThird,
				entries: third,
				styles: {
					size: totalStyleThird,
					entries: stylesThird
				},
				scripts: {
					size: totalScriptThird,
					entries: scriptsThird
				},
				images: {
					size: totalImgThird,
					entries: imagesThird
				}
			}
		}
	};
};

function getEncodedSize (entry) {
	if (entry._performanceEntry) {
		return entry.response.bodySize;
	}
	else {
		for (var i = entry.response.headers.length - 1; i >= 0; i--) {
			if (entry.response.headers[i].name === 'content-length') {
				return parseInt(entry.response.headers[i].value, 10);
			};
		};
	};

	return entry.response.content.size;
};

function getTransferSize (entry) {
	if (entry._performanceEntry) {
		return entry.response._transferSize;
	}
	else {
		return getEncodedSize(entry);
	}
};
