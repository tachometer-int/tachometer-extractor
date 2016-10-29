var fs = require('fs');
var path = require('path');
var chc = require('chrome-har-capturer');
var onHars = require('./balanceHars');

module.exports = harExtractor;

/**
 * получатель ХАРов
 * @param  {string} url   адрес проверяемой страницы
 * @param  {number} count количество повторов проверок
 * @param  {string} dist  путь, куда сохранять с указанием расширения
 */
function harExtractor (url, count, dist) {
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
		path.dirname(dist),
		path.basename(dist, path.extname(dist)) +'.cache.har'
	);

	// сюда будут записаны полученные данные
	var hars = [];
	
	// запускаем проверку с кешем
	start(url, hars, count, onHars, function (har) {
		fs.writeFileSync(distCache, JSON.stringify(har));
	
		// и без кеша
		start(url, hars, count, onHars, function (har) {
			fs.writeFileSync(distClean, JSON.stringify(har));
		}, false);
	}, true);
};

// начало работы
function start (url, hars, count, onHars, onResult, cache) {
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
			onHars(hars, onResult);
		}
		else {

			// пока есть, чем заняться
			start(url, hars, count, onHars, onResult, cache);
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
		console.log('Connected to Chrome');
		getStart = new Date().getTime();
	});
	c.once('end', function (har) {
		console.log('Collected data');

		// определяем продолжительность получения данных
		har._duration = new Date().getTime() - getStart;
		cb(har);
	});
	c.once('error', function (err) {
		console.error('Cannot connect to Chrome: ' + err);
	});
};
