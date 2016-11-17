var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var chc = require('chrome-har-capturer');

var balancer = require('./balancer');
var processor = require('./processor');

module.exports = tachometerExtractor;

/**
 * получатель ХАРов
 * @param  {string} url   адрес проверяемой страницы
 * @param  {number} count количество повторов проверок
 * @param  {string} dist  путь, куда сохранять с указанием расширения
 */
function tachometerExtractor (url, count, dist) {
	if (typeof url === 'undefined') {
		console.log('Нужен адрес для проверки');
		return;
	};

	// количество повторов
	count = count || 10;
	count++;

	// путь к данным без кеша
	distClean = dist || path.join(process.cwd(), 'result.har');
	distClean = path.normalize(distClean);

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

	// стартуем хром
	var chrome = spawn('chrome', [
		'--remote-debugging-port=9222',
		'--enable-benchmarking',
		'--enable-net-benchmarking'
	]);

	// ждём загрузки хрома
	setTimeout(function () {
	
		// запускаем проверку с кешем
		start(url, harsCache, count, function (harCache) {
			fs.writeFileSync(distCache, JSON.stringify(harCache));

			// и без кеша
			start(url, harsClean, count, function (harClean) {
				fs.writeFileSync(distClean, JSON.stringify(harClean));

				// вычисляем и пишем значения
				fs.writeFileSync(distData, JSON.stringify(processor(harClean, harCache)));

				// выключаем хром
				chrome.kill();
			}, false);
		}, true);
	}, 1000)
};

// начало работы
function start (url, hars, count, onResult, cache) {
	if (count < 1) { return; };

	count--;
	getHar(url, cache, onHar);

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
			start(url, hars, count, onResult, cache);
		};
	};
};

// получение хара
function getHar (url, cache, cb) {
	var c = chc.load(url, {
		cache: cache,
		onLoadDelay: 10000,
		onLastResponseDelay: 3000
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
