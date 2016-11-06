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

		// вычисляем среднее по основным показателям
		for (key in result.log.pages[0].pageTimings) {
			result.log.pages[0].pageTimings[key] = (result.log.pages[0].pageTimings[key] + har.pages[0].pageTimings[key]) / 2;
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

			// считаем среднее от времени выполнения
			entry.time = (entry.time + _entry.time) / 2;

			// считаем среднее от составляющих выполнения
			for (key in _entry.timings) {
				if (entry.timings[key] > -1 && _entry.timings[key] > -1) {
					entry.timings[key] = (entry.timings[key] + _entry.timings[key]) / 2;
				};
			};

			// считаем среднее от времени начала
			entry.startedDateTime = (entry.startedDateTime + _entry.startedDateTime) / 2;

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
