// Baseado no exemplo https://codepen.io/Russbrown/pen/IgBuh

function TodoCtrl($scope, $http) {

	document.getElementById('butRefresh').addEventListener('click', function() {
		$scope.callAPI().then(function () {
			$scope.getTodos()
		})
		// $scope.sync()
	});

  $scope.todos = [];
	$scope.$watch('todos', function (n, o) {
		// console.log('watch', o, n)
	}, true)

	$scope.app = {
    isLoading: true,
    spinner: document.querySelector('.loader'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container')
  };

	$scope.app.toggleAddDialog = function(visible) {
    if (visible) {
      app.addDialog.classList.add('dialog-container--visible');
    } else {
      app.addDialog.classList.remove('dialog-container--visible');
    }
  };

	$scope.app.checkLoading = function () {
		if ($scope.app.isLoading) {
      $scope.app.spinner.setAttribute('hidden', true);
      $scope.app.isLoading = false;
    }
	}

	$scope.checkInternalDB = function (callback) {
		var self = this
		self.callback = callback
		if (!$scope._db) {
			$scope.idb = indexedDB.open('todoPWA')
			$scope.idb.onupgradeneeded = function (event) {
				var db = event.target.result
				db.createObjectStore('task', { keyPath: 'ID' })
			}
			$scope.idb.onsuccess = function(event) {
				$scope._db = event.target.result
				self.callback($scope._db)
			}
		}
		else
			self.callback($scope._db)
	}

	$scope.syncIn = function (data) {
		// console.log('syncIn', data)
		$scope.checkInternalDB(function (db) {
			var tx = db.transaction('task', 'readwrite')
			var store = tx.objectStore("task")
			if (data instanceof Array) {
				for (var i = 0; i < data.length; i++)
				{
					store.put({ content: data[i], ID: data[i].id })
				}
			} else {
				store.put({ content: data, ID: data.id })
			}
		})
	}

	$scope.syncOut = function () {
		return new Promise(function (resolve, reject) {
			$scope.checkInternalDB(function (db) {
				var tasks = []

				var tx = db.transaction('task')
				var store = tx.objectStore("task")
				var request = store.openCursor()

				request.onsuccess = function(event) {
					$scope.$apply(function () {
						var cursor = event.target.result
						if (cursor) {
							var task = cursor.value
							if ($scope.checkTaskUnsynced(task)) {
								tasks.push(task)
							}
							cursor.continue()
						}
						else {
							resolve(tasks)
						}
					})
				}

				request.onerror = function (event) {
					reject(event)
				}
			})
		})
	}

	$scope.removeIDB = function (task) {
		return new Promise(function (resolve, reject) {
			$scope.checkInternalDB(function (db) {
				var tx = db.transaction('task', 'readwrite')
				var store = tx.objectStore("task")
				var request = store.delete(task.id)

				request.onsuccess = function (event) {
					resolve(task)
				}

				request.onerror = function (event) {
					reject(event)
				}
			})
		})
	}

	$scope.checkTaskUnsynced = function (task) {
		if (task.id < 0)
			return true

		var oldTask = $scope.todos.filter(function (value) {
			if (value.id == task.id) {
				if (value.lastUpdate < task.lastUpdate)
					return true
				return false
			}
		})

		return false
	}

	$scope.getTodos = function () {
		var url = 'https://localhost:8443/api/tasks'
		$scope.callAPI({
			method: 'GET',
			url: url
		}).then(function (data) {
			$scope.setTodos(data.tasks)
			$scope.app.checkLoading()
		}, function (response) {
			if ('caches' in window) {
				caches.match(url).then(function (response) {
					if (response) {
						response.json().then(function (data) {
							$scope.$apply(function () {
								$scope.setTodos(data.tasks)
								$scope.app.checkLoading()
							})
						})
					}
				})
			}
			$scope.app.checkLoading()
		});
	};

	$scope.setTodos = function (data) {
		// console.log('setTodos', data)
		$scope.todos = data
		$scope.syncIn(data)
	}

  $scope.getTotalTodos = function () {
    return $scope.todos.filter(function (task) {
			return (!task.hide)
		}).length || 0;
  };

  $scope.addTodo = function () {
		if ($scope.formTodoText === '')
			return
		var task = {
			id: null,
			text: $scope.formTodoText,
			done: false,
			hide: false,
			lastUpdate: new Date()
		}
		$scope.callAPI({
			method: 'POST',
			data: { task: task },
			url: 'https://localhost:8443/api/tasks'
		}).then(function (response) {
			// console.log('addTodo', response.data.task)
			$scope.todos.push(response.data.task);
			$scope.syncIn(response.data.task)
		}, function (response) {
			console.error('addTodo', response)
			task.id = -1 * $scope.todos.length
			$scope.syncIn(task)
			$scope.todos.push(task);
		});

    $scope.formTodoText = '';
  };

	$scope.clearCompleted = function () {
		for (var i = 0; i < $scope.todos.length; i++)
		{
			var task = $scope.todos[i]
			if (task.done && !task.hide)
			{
				task.hide = true
				task.lastUpdate = new Date()
				$scope.callAPI({
					method: 'PUT',
					data: { task: task },
					url: 'https://localhost:8443/api/tasks'
				}).then(function (response) {
					$scope.getTodos()
				}, function (response) {
					// console.error('clearCompleted', response)
					$scope.syncIn(task)
				});
			}
		}
	};

	$scope.changeDone = function ($event, task) {
		// console.log('changeDone value', $event.currentTarget.checked)
		task.done = $event.currentTarget.checked
		task.lastUpdate = new Date()
		$scope.callAPI({
			method: 'PUT',
			data: { task: task },
			url: 'https://localhost:8443/api/tasks'
		}).then(function (data) {
			// console.log('changeDone', data.task)
			task = data.task;
			$scope.syncIn(task)
		}, function (response) {
			// console.error('changeDone', response)
			$scope.syncIn(task)
		});
	}

	$scope.callAPI = function (options = { method: 'GET', url: 'https://localhost:8443/api' }) {
		return new Promise(function (resolve, reject) {
			$http(options).then(function (response) {
				if (response.data.alive) {
					resolve(response.data)
				} else {
					reject('Database not alive')
				}
			}, function (error) {
				reject(error)
			})
		})
	}

	$scope.sync = function () {
		$scope.callAPI().then(function (data) {
			console.log('Checking data to sync...')
			$scope.syncOut().then(function (tasks) {
				if (tasks.length > 0) {
					console.log('Data to sync', tasks)
					for(var i = 0; i < tasks.length; i++) {
						var task = tasks[i]
						if (task.id < 0) {
							$scope.callAPI({
								method: 'POST',
								data: { task: task },
								url: 'https://localhost:8443/api/tasks'
							}).then(function (resp) {
								console.log('Task removed from indexedDB', task)
								$scope.removeIDB(task).then(function (t) {
									task = resp.data.task
									console.log('Task add to indexedDB', task)
									$scope.syncIn(task)
								})
							})
						} else {
							$scope.callAPI({
								method: 'PUT',
								data: { task: task },
								url: 'https://localhost:8443/api/tasks'
							}).then(function (resp) {
								console.log('Task removed from indexedDB', task)
								$scope.removeIDB(task).then(function (t) {
									task = resp.data.task
									console.log('Task add to indexedDB', task)
									$scope.syncIn(task)
								})
							})
						}
					}
				} else {
					console.log('No data to sync')
				}
			}).then(function (data) {
				console.log('Sync finished')
			})
		})
	}

	document.getElementById('butRefresh').click()
	// setInterval($scope.sync, 5000)
	// $scope.callAPI().then(function () {
	// 	$scope.getTodos()
	// })
}

if ('serviceWorker' in navigator) {
	navigator.serviceWorker
		.register('./service-worker.js')
		.then(function () {
			// console.log('Service Worker Registered!')
		})
}