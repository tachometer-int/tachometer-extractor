var fs = require('fs');
var path = require('path');
var exec = require('child_process').execSync;
var spawn = require('child_process').spawn;
var chc = require('chrome-har-capturer');

var balancer = require('./balancer');
var processor = require('./processor');

module.exports = tachometerExtractor;

/**
 * получатель ХАРов
 * @param  {object} cfg объект с настройками
 */
function tachometerExtractor (cfg) {
	if (typeof cfg.url === 'undefined') {
		console.log('Нужен адрес для проверки');
		return;
	};

	// адрес проверяемой страницы
	var url = cfg.url;

	// количество повторов проверок
	var count = parseInt(cfg.count, 10) || 10;

	// путь, куда сохранять с указанием расширения
	var dist = cfg.dist || path.join(process.cwd(), 'result.har');

	// скрипт для подготовки теста
	var prepareScript = cfg.prepare || '';

	// путь к данным без кеша
	var distClean = cfg.dist || path.join(process.cwd(), 'result.har');
	var distClean = path.normalize(distClean);

	// путь к данным с кешем
	var distCache = path.join(
		path.dirname(distClean),
		path.basename(distClean, path.extname(distClean)) +'.cache.har'
	);

	// путь к вычисленным значениям
	var distData = path.join(
		path.dirname(distClean),
		path.basename(distClean, path.extname(distClean)) +'.data.json'
	);

	// сюда будут записаны полученные данные
	var harsCache = [];
	var harsClean = [];

	// первый запуск — холостой
	count++;

	// отключаем все хромы перед работой
	exec('taskkill /f /im chrome.exe /fi "memusage gt 2"');

	// стартуем хром
	var chrome = spawn('chrome', [
		'--remote-debugging-port=9222'
	]);

	// ждём загрузки хрома
	setTimeout(function () {
		var prepare = '';

		if (prepareScript) {
			prepare = prepareScript;
			prepareScript = '';
		};

		// запускаем проверку с кешем
		start(url, harsCache, count, true, prepare, function (harCache) {
			fs.writeFileSync(distCache, JSON.stringify(harCache));

			// и без кеша
			start(url, harsClean, count, false, prepare, function (harClean) {
				fs.writeFileSync(distClean, JSON.stringify(harClean));

				// вычисляем и пишем значения
				fs.writeFileSync(distData, JSON.stringify(processor(harClean, harCache)));

				// выключаем хром
				chrome.kill();
			});
		});
	}, 1000)
};

// начало работы
function start (url, hars, count, cache, prepare, onResult) {
	if (count < 1) { return; };

	count--;
	getHar(url, cache, prepare, onHar);

	// хар получен
	function onHar (har) {

		// помещаем его в массив
		hars.push(har);

		if (count < 1) {

			// все получены
			hars.splice(0, 1);
			balancer(hars, onResult);
		}
		else {

			// пока есть, чем заняться
			start(url, hars, count, cache, prepare, onResult);
		};
	};
};

// получение хара
function getHar (url, cache, prepare, cb) {
	var c = chc.load(url, {
		cache: cache,
		onLoadDelay: 10000,
		onLastResponseDelay: 3000,
		prepare: prepare
	});
	var getStart;

	c.once('connect', function () {
		console.log('Подключен к хрому');
		getStart = new Date().getTime();
	});
	c.once('end', function (har) {
		console.log('Собрал данные');

		// определяем продолжительность получения данных
		har._duration = new Date().getTime() - getStart;
		cb(har);
	});
	c.once('error', function (err) {
		console.error('Не удаётся подключиться к хрому. Убедитесь, что он запущен.');
		console.error(err);
	});
};
