module.exports = balancer;

function balancer (hars, onResult) {

	// нормализуем время начала процессов
	for (var l = 0; l < hars.length; l++) {
		var har = hars[l].log;

		if (typeof har.pages[0].startedDateTime !== 'string') {
			continue;
		};

		var start = new Date(har.pages[0].startedDateTime).getTime();

		har.pages[0].startedDateTime = start;

		// вычисляем начало каждого запроса
		// относительно начала загрузки страницы
		for (var m = 0; m < har.entries.length; m++) {
			var entry = har.entries[m];

			entry.startedDateTime = new Date(entry.startedDateTime).getTime() - start;
		};
	};

	// первый будет результатом
	var result = hars[0];

	// сюда будем помещать несовпадающие записи
	var newEntries = [];

	// работаем с остальными харами
	for (var i = 1; i < hars.length; i++) {
		var har = hars[i].log;

		// готовим подсчёт медианы по основным показателям
		var pageTimings = result.log.pages[0].pageTimings;
		var pageTimingsHar = har.pages[0].pageTimings;

		for (key in pageTimings) {
			mediator(key, pageTimings, pageTimingsHar);

			// считаем медиану от времени выполнения
			if (i + 1 === hars.length) {
				if (!isNumber(pageTimings[key])) { continue; };
				pageTimings[key] = findMedian(pageTimings._median[key]);
			};
		};

		// суммируем запросы
		for (var j = 0; j < har.entries.length; j++) {
			var _entry = har.entries[j];

			// ищем совпадающие
			if (!balanceEntry(_entry, result.log.entries)) {
				if (!balanceEntry(_entry, newEntries)) {
					newEntries.push(_entry);
				};
			};
		};
	};

	// добавляем недостающие записи
	result.log.entries.concat(newEntries);

	// упорядочиваем записи
	result.log.entries.sort(function (a, b) {
		if (a.startedDateTime > b.startedDateTime) {
			return 1;
		}
		else if (a.startedDateTime < b.startedDateTime) {
			return -1;
		};
	});	

	// возвращаем время записей в нужном формате
	var start = result.log.pages[0].startedDateTime;

	for (var n = 0; n < result.log.entries.length; n++) {
		var entry = result.log.entries[n];

		if (entry._median) {

			// считаем медиану от времени выполнения
			entry['time'] = findMedian(entry._median['time']);

			// считаем медиану от времени начала
			entry['startedDateTime'] = findMedian(entry._median['startedDateTime']);
		};

		// считаем медиану от составляющих выполнения
		if (entry.timings._median) {
			for (key in _entry.timings) {
				if (!isNumber(entry.timings[key])) { continue; };

				if (entry.timings[key] > -1 && _entry.timings[key] > -1) {
					entry.timings[key] = findMedian(entry.timings._median[key]);
				};
			};
		};

		// ограничиваем время неадекватно долгих записей
		if (entry.startedDateTime + entry.time > result._duration) {
			entry.time = result._duration - entry.startedDateTime;

			// поле получения данных может быть неверным
			if (entry.timings.receive > entry.time) {
				entry.timings.receive = entry.time;
				for (key in entry.timings) {
					if (
						key !== 'receive'
						&& entry.timings[key] > 0
					) {
						entry.timings.receive = entry.timings.receive - entry.timings[key];
					};
				};
			};
		};

		// возвращаем формат времени
		entry.startedDateTime = new Date(start + entry.startedDateTime).toISOString();
	};

	// возвращаем основные показатели
	result.log.pages[0].startedDateTime = new Date(result.log.pages[0].startedDateTime).toISOString();

	// отправляем результат
	onResult(result);
};

// выравнивание значений записей
function balanceEntry (_entry, resultEntries) {
	for (var k = 0; k < resultEntries.length; k++) {
		var entry = resultEntries[k];
		var isFound = false;

		// если запрос по одному адресу
		if (entry.request.url === _entry.request.url) {

			// готовим подсчёт медианы от времени выполнения
			mediator('time', entry, _entry);

			// готовим подсчёт медианы от составляющих выполнения
			for (key in _entry.timings) {
				if (entry.timings[key] > -1 && _entry.timings[key] > -1) {
					mediator(key, entry.timings, _entry.timings);
				};
			};

			// готовим подсчёт медианы от времени начала
			mediator('startedDateTime', entry, _entry);

			// если запись есть
			isFound = true;
			break;
		};
	};

	// возвращаем найденность записи
	if (!isFound) {
		return false;
	}
	else {
		return true;
	};
};

// вычислитель медианы
function mediator (key, a, b) {
	if (!isNumber(a[key])) { return; };

	if (!a._median) {
		a._median = {};
	};
	if (!a._median[key]) {
		a._median[key] = [];
		a._median[key].push(a[key]);
	};

	a._median[key].push(b[key]);
};

// ищет медиану в массиве
function findMedian (data) {
	data.sort(function(a,b) {
		return a - b;
	});

	var half = Math.floor(data.length / 2);

	if (data.length % 2) {
		return data[half];
	}
	else {
		return (data[half-1] + data[half]) / 2.0;
	};
};

// передано ли число
function isNumber (n) {
	return typeof n === 'number';
};
