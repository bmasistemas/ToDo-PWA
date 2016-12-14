// Baseado no exemplo https://codepen.io/Russbrown/pen/IgBuh

function TodoCtrl ($scope, $http) {
  document.getElementById('butRefresh').addEventListener('click', function () {
    $scope.callAPI().then(function () {
      $scope.getTodos()
    })
  })

  $scope.todos = []
  $scope.$watch('todos', function (n, o) {
    // console.log('watch', o, n)
  }, true)

  $scope.getNow = function () {
    var d = new Date()
    console.log('getNow1', d)
    d.setMilliseconds(0)
    console.log('getNow2', d)
    return d
  }

  $scope.app = {
    isLoading: true,
    spinner: document.querySelector('.loader'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container')
  }

  $scope.app.toggleAddDialog = function (visible) {
    if (visible) {
      $scope.app.addDialog.classList.add('dialog-container--visible')
    } else {
      $scope.app.addDialog.classList.remove('dialog-container--visible')
    }
  }

  $scope.app.checkLoading = function () {
    if ($scope.app.isLoading) {
      $scope.app.spinner.setAttribute('hidden', true)
      $scope.app.isLoading = false
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
      $scope.idb.onsuccess = function (event) {
        $scope._db = event.target.result
        self.callback($scope._db)
      }
    } else {
      self.callback($scope._db)
    }
  }

  $scope.syncIn = function (data) {
    return new Promise(function (resolve, reject) {
      $scope.checkInternalDB(function (db) {
        var tx = db.transaction('task', 'readwrite')
        var store = tx.objectStore('task')
        if (data instanceof Array) {
          // console.log('syncIn', data)
          for (var i = 0; i < data.length; i++) {
            $scope.getIDB(store, data[i]).then(function (db) {
              // console.log('getIDB1', db.param, db.base)
              if (db.param.lastUpdate === db.base.lastUpdate) {
                return
              }
              if (db.param.lastUpdate > db.base.lastUpdate) {
                // console.log('must update indexedDB')
                store.put({ content: db.param, ID: db.param.id })
              } else {
                // console.log('must update api')
                $scope.callAPI({
                  method: 'PUT',
                  data: { task: db.base },
                  url: 'https://test.fumasa.org/api/tasks'
                }).then(function (data) {
                  // console.log('callAPI(PUT)', data)
                  $scope.syncIn(data.task)
                }, function (response) {
                  console.error('callAPI(PUT)', response)
                })
              }
            }, function (task, event) {
              // console.log('getIDB2', task, event)
              store.put({ content: task, ID: task.id })
            })
          }
          resolve(data)
        } else {
          store.put({ content: data, ID: data.id })
          $scope.setTodos(data)
        }
      })
    })
  }

  $scope.syncOut = function (tasksDB = null) {
    return new Promise(function (resolve, reject) {
      $scope.checkInternalDB(function (db) {
        var tasks = []

        var tx = db.transaction('task')
        var store = tx.objectStore('task')
        var request = store.openCursor()

        request.onsuccess = function (event) {
          $scope.$apply(function () {
            var cursor = event.target.result
            if (cursor) {
              var task = cursor.value
              if (tasksDB !== null) {
                var t = tasksDB.filter(function (value) {
                  if (value.id === task.content.id) {
                    return true
                  } else {
                    return false
                  }
                })
                if (task.content.lastUpdate > t[0].lastUpdate) {
                  tasks.push(task.content)
                }
              } else {
                tasks.push(task.content)
              }

              cursor.continue()
            } else {
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
        var store = tx.objectStore('task')
        // console.log('removeIDB', task)
        var request = store.delete(task.ID)

        request.onsuccess = function (event) {
          resolve(task)
        }

        request.onerror = function (event) {
          reject(event)
        }
      })
    })
  }

  $scope.getIDB = function (store, task) {
    return new Promise(function (resolve, reject) {
      // console.log('getIDB', task)
      var request = store.get(task.id)
      request.onerror = function (event) {
        reject(task, event)
      }
      request.onsuccess = function (event) {
        if (request.result) {
          // console.log('getIDB', event.target.result.content)
          resolve({ param: task, base: event.target.result.content })
        } else {
          reject(task, event)
        }
      }
    })
  }

  $scope.getTodos = function () {
    return new Promise(function (resolve, reject) {
      var url = 'https://test.fumasa.org/api/tasks'
      $scope.callAPI({
        method: 'GET',
        url: url
      }).then(function (data) {
        $scope.syncIn(data.tasks).then(function (tasks) {
          $scope.$apply(function () {
            $scope.setTodos(tasks)
            $scope.app.checkLoading()
            resolve(tasks)
          })
        })
      }, function (response) {
        $scope.syncOut().then(function (tasks) {
          $scope.$apply(function () {
            $scope.setTodos(tasks)
            $scope.app.checkLoading()
            resolve(tasks)
          })
        })
      })
    })
  }

  $scope.setTodos = function (data) {
    // console.log('setTodos', data, $scope.todos)
    if (data instanceof Array) {
      $scope.todos = data
    } else {
      $scope.todos = $scope.todos.map(function (value) {
        if (value.id === data.id) {
          return data
        }
        return value
      })
    }
    // console.log('setTodos out', $scope.todos)
  }

  $scope.getTotalTodos = function () {
    return $scope.todos ? $scope.todos.filter(function (task) {
      return (!task.hide)
    }).length : 0
  }

  $scope.addTodo = function () {
    if ($scope.formTodoText === '') {
      return
    }
    var task = {
      id: null,
      text: $scope.formTodoText,
      done: false,
      hide: false,
      lastUpdate: $scope.getNow().toISOString()
    }
    $scope.callAPI({
      method: 'POST',
      data: { task: task },
      url: 'https://test.fumasa.org/api/tasks'
    }).then(function (response) {
      $scope.$apply(function () {
        // console.log('addTodo', response.task)
        $scope.todos.push(response.task)
        $scope.syncIn(response.task)
      })
    }, function (response) {
      $scope.$apply(function () {
        console.error('addTodo', response)
        task.id = -1 * $scope.todos.length
        $scope.syncIn(task)
        $scope.todos.push(task)
      })
    })

    $scope.formTodoText = ''
  }

  $scope.clearCompleted = function () {
    for (var i = 0; i < $scope.todos.length; i++) {
      var task = $scope.todos[i]
      if (task.done && !task.hide) {
        task.hide = true
        task.lastUpdate = $scope.getNow().toISOString()
        $scope.callAPI({
          method: 'PUT',
          data: { task: task },
          url: 'https://test.fumasa.org/api/tasks'
        }).then(function (response) {
          $scope.getTodos()
        }, function (response) {
          // console.error('clearCompleted', response)
          $scope.syncIn(task)
        })
      }
    }
  }

  $scope.changeDone = function ($event, task) {
    // console.log('changeDone value', $event.currentTarget.checked)
    console.log('changeDone', task)
    task.done = $event.currentTarget.checked
    task.lastUpdate = $scope.getNow().toISOString()
    $scope.callAPI({
      method: 'PUT',
      data: { task: task },
      url: 'https://test.fumasa.org/api/tasks'
    }).then(function (data) {
      // console.log('changeDone', data.task)
      $scope.syncIn(data.task)
    }, function (response) {
      // console.error('changeDone', response)
      $scope.syncIn(task)
    })
  }

  $scope.callAPI = function (options = { method: 'GET', url: 'https://test.fumasa.org/api' }) {
    return new Promise(function (resolve, reject) {
      $http(options).then(function (response) {
        // console.log('callAPI', response.data)
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

  document.getElementById('butRefresh').click()
  setInterval(function () {
    document.getElementById('butRefresh').click()
  }, 5000)
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service-worker.js')
    .then(function () {
      // console.log('Service Worker Registered!')
    })
}
