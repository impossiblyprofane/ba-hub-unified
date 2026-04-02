window.onload = function() {
  //<editor-fold desc="Changeable Configuration Block">

  // the following lines will be replaced by docker/configurator, when it runs in a docker-container
  window.ui = SwaggerUIBundle({
    spec: {
      "openapi": "3.0.1",
      "info": {
        "title": "BaRest",
        "version": "v1"
      },
      "paths": {
        "/admin/user/{userId}": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение информации о пользователе по userId",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "Внутренний id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "Внутренний id юзера",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfo"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfo"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfo"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение информации о пользователе по подстроке имени",
            "parameters": [
              {
                "name": "like",
                "in": "query",
                "description": "подстрока",
                "schema": {
                  "type": "string",
                  "description": "подстрока",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestAdminUserInfo"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestAdminUserInfo"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestAdminUserInfo"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/banned": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение всех забаненных пользователей",
            "parameters": [
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32"
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelBanHistoryRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelBanHistoryRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelBanHistoryRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/banned-old": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение всех забаненных пользователей (obsolete)",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestAdminUserInfo"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestAdminUserInfo"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestAdminUserInfo"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/{userId}/ban": {
          "post": {
            "tags": [
              "Administration"
            ],
            "summary": "Забанить пользователя",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id пользователя",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id пользователя",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "данные бана",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAdminBanData"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAdminBanData"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAdminBanData"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAdminBanData"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelBanHistory"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelBanHistory"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelBanHistory"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/top-reports/{type}": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение топ юзеров по типу репорта исключая забаненных",
            "parameters": [
              {
                "name": "type",
                "in": "path",
                "description": "тип репорта",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "тип репорта",
                  "format": "int32"
                }
              },
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32",
                  "default": 1
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfoRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfoRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfoRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/{userId}/reports-overview": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение статистики репортов по игроку",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id игрока",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id игрока",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfo"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfo"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserInfo"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/{userId}/user-reports": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение юзер репортов по игроку",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id игрока",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id игрока",
                  "format": "int32"
                }
              },
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32",
                  "default": 1
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserReportRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserReportRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminUserReportRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/{userId}/system-reports": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получение системных репортов по игроку",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id игрока",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id игрока",
                  "format": "int32"
                }
              },
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32",
                  "default": 1
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminSystemReportRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminSystemReportRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminSystemReportRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/user/{userId}/user-reports/clear": {
          "post": {
            "tags": [
              "Administration"
            ],
            "summary": "Очищает все юзер репорты для игрока.",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id игрока",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id игрока",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/admin/user/{userId}/system-reports/clear": {
          "post": {
            "tags": [
              "Administration"
            ],
            "summary": "Очищает все системные репорты для игрока.",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id игрока",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id игрока",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/admin/moderator-history": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получить историю действий модераторов",
            "parameters": [
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32",
                  "default": 1
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminModeratorHistoryRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminModeratorHistoryRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminModeratorHistoryRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/fight-history": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получить историю боев",
            "parameters": [
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32",
                  "default": 1
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminFightHistoryRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminFightHistoryRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminFightHistoryRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/admin/ban-history": {
          "get": {
            "tags": [
              "Administration"
            ],
            "summary": "Получить историю банов",
            "parameters": [
              {
                "name": "page",
                "in": "query",
                "description": "Номер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Номер страницы",
                  "format": "int32",
                  "default": 1
                }
              },
              {
                "name": "pageSize",
                "in": "query",
                "description": "Размер страницы",
                "schema": {
                  "type": "integer",
                  "description": "Размер страницы",
                  "format": "int32",
                  "default": 50
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminBanHistoryRestPaginatedResult"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminBanHistoryRestPaginatedResult"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAdminBanHistoryRestPaginatedResult"
                    }
                  }
                }
              }
            }
          }
        },
        "/auth/login": {
          "post": {
            "tags": [
              "Auth"
            ],
            "summary": "Аутентификация клиента и проверка владения продуктом",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequest"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequest"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequest"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequest"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/auth/logout": {
          "post": {
            "tags": [
              "Auth"
            ],
            "summary": "Логаут клиента. Используется мастер сервером",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "integer",
                    "format": "int32"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/auth/ping": {
          "post": {
            "tags": [
              "Auth"
            ],
            "summary": "Пинг клиента",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/auth/v2/steam": {
          "post": {
            "tags": [
              "AuthControllerV2"
            ],
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/auth/v2/vkplay": {
          "post": {
            "tags": [
              "AuthControllerV2"
            ],
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/auth/v2/login": {
          "post": {
            "tags": [
              "AuthControllerV2"
            ],
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAuthRequestV2"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestAuthResponse"
                    }
                  }
                }
              }
            }
          }
        },
        "/config/maps": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Устанавливает список мультиплеерных карт",
            "requestBody": {
              "description": "список карт",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить список мультиплеерных карт",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestMapInfo"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestMapInfo"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestMapInfo"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/config/map_pool": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Устанавливает мап пул для мультиплеера",
            "requestBody": {
              "description": "список карт",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestMapInfo"
                    },
                    "description": "список карт"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить мап пул для мультиплеера",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestMapInfo"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestMapInfo"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestMapInfo"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/config/triggers": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Устанавливает конфиг для триггеров, сколько очков за победу и т.д.",
            "requestBody": {
              "description": "триггер конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestTriggerConfig"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestTriggerConfig"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestTriggerConfig"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestTriggerConfig"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить конфиг для триггеров",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestTriggerConfig"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestTriggerConfig"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestTriggerConfig"
                    }
                  }
                }
              }
            }
          }
        },
        "/config/sentry": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Устанавливает конфиг для sentry",
            "requestBody": {
              "description": "sentry конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestSentryConfig"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestSentryConfig"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestSentryConfig"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestSentryConfig"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить конфиг для sentry",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestSentryConfig"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestSentryConfig"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestSentryConfig"
                    }
                  }
                }
              }
            }
          }
        },
        "/config/server": {
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить конфиг для сервера",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestServerConfig"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestServerConfig"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestServerConfig"
                    }
                  }
                }
              }
            }
          }
        },
        "/config/user_progress": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Установить конфиг прогрессии юзера",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserProgressConfig"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserProgressConfig"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserProgressConfig"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserProgressConfig"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить конфиг прогрессии юзера",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/config/refresh": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Обновить конфиги на серверах",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/config/formulas_common": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Обновить основные луа функции на серверах",
            "requestBody": {
              "description": "основные луа функции",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "string"
                    },
                    "description": "основные луа функции"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "string"
                    },
                    "description": "основные луа функции"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "string"
                    },
                    "description": "основные луа функции"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "string"
                    },
                    "description": "основные луа функции"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить основные луа функции на серверах",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/config/medals": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Установить конфиг для медалей",
            "requestBody": {
              "description": "конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMedalsConfig"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMedalsConfig"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMedalsConfig"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMedalsConfig"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получить конфиг для медалей",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestMedalsConfig"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestMedalsConfig"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestMedalsConfig"
                    }
                  }
                }
              }
            }
          }
        },
        "/config/database": {
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получение конфига базы данных. Если передан хэш - проверка на актуальность",
            "parameters": [
              {
                "name": "hash",
                "in": "query",
                "description": "Хэш",
                "schema": {
                  "type": "string",
                  "description": "Хэш",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestDatabaseConfig"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestDatabaseConfig"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestDatabaseConfig"
                    }
                  }
                }
              }
            }
          },
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Установка конфига базы данных",
            "requestBody": {
              "description": "Конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestDatabaseConfig"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestDatabaseConfig"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestDatabaseConfig"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestDatabaseConfig"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/config/items": {
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получение конфига всех айтемов",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Установка конфига всех айтемов",
            "requestBody": {
              "description": "Конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/RestClientItem"
                    },
                    "description": "Конфиг"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/RestClientItem"
                    },
                    "description": "Конфиг"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/RestClientItem"
                    },
                    "description": "Конфиг"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/RestClientItem"
                    },
                    "description": "Конфиг"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/config/game_modes": {
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получение конфига игровых режимов",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Установка конфига игровых режимов",
            "requestBody": {
              "description": "конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestGameModesConfig"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestGameModesConfig"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestGameModesConfig"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestGameModesConfig"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/config/dlc_containers": {
          "post": {
            "tags": [
              "Config"
            ],
            "summary": "Установка конфига DLC контейнеров",
            "requestBody": {
              "description": "конфиг",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestContainerDLC"
                    },
                    "description": "конфиг"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestContainerDLC"
                    },
                    "description": "конфиг"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestContainerDLC"
                    },
                    "description": "конфиг"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/RestContainerDLC"
                    },
                    "description": "конфиг"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "get": {
            "tags": [
              "Config"
            ],
            "summary": "Получение конфига DLC контейнеров",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/deck/{deckHash}": {
          "get": {
            "tags": [
              "Deck"
            ],
            "summary": "Получение деки по хэшу",
            "parameters": [
              {
                "name": "deckHash",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "string",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "put": {
            "tags": [
              "Deck"
            ],
            "summary": "Обновление деки по хэшу",
            "parameters": [
              {
                "name": "deckHash",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "string",
                  "nullable": true
                }
              }
            ],
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "string"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "string"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "string"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "string"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "delete": {
            "tags": [
              "Deck"
            ],
            "summary": "Удаление деки по хэшу",
            "parameters": [
              {
                "name": "deckHash",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "string",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/deck": {
          "post": {
            "tags": [
              "Deck"
            ],
            "summary": "Сохранение деки",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "string"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "string"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "string"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "string"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/gameMarket/{marketType}/friends/{marketId}": {
          "get": {
            "tags": [
              "GameMarket"
            ],
            "summary": "Получение друзей юзера из гейммаркета",
            "parameters": [
              {
                "name": "marketType",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "integer",
                  "format": "int32"
                }
              },
              {
                "name": "marketId",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "string",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/lobby/list": {
          "get": {
            "tags": [
              "Lobby"
            ],
            "summary": "Получить список всех лобби",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelLobbyList"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelLobbyList"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelLobbyList"
                    }
                  }
                }
              }
            }
          }
        },
        "/lobby/listAll": {
          "get": {
            "tags": [
              "Lobby"
            ],
            "summary": "Полный список лобби включая невидимые, для мониторинга",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelLobbyList"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelLobbyList"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/ModelLobbyList"
                    }
                  }
                }
              }
            }
          }
        },
        "/lobby/getServer": {
          "get": {
            "tags": [
              "Lobby"
            ],
            "summary": "Получить лобби сервер",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/LobbyServer"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/LobbyServer"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/LobbyServer"
                    }
                  }
                }
              }
            }
          }
        },
        "/monitoring/serverHealth": {
          "post": {
            "tags": [
              "Monitoring"
            ],
            "summary": "Устанавливает состояние сервера (загрузка озу, цп и т.д.)",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/ServerHealth"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ServerHealth"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ServerHealth"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/ServerHealth"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/monitoring/serverStatus": {
          "post": {
            "tags": [
              "Monitoring"
            ],
            "summary": "Устанавливает игровой статус сервера (кол-во инстансов, клиентов и т.д.)",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestServerStatus"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestServerStatus"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestServerStatus"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestServerStatus"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          },
          "get": {
            "tags": [
              "Monitoring"
            ],
            "summary": "Получить статус по всем серверам",
            "parameters": [
              {
                "name": "shortVersion",
                "in": "query",
                "schema": {
                  "type": "boolean"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/monitoring/serverUpdateStatus": {
          "post": {
            "tags": [
              "Monitoring"
            ],
            "summary": "Установить статус серверов",
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMasterOnline"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMasterOnline"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMasterOnline"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestMasterOnline"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/monitoring/masterOnline": {
          "get": {
            "tags": [
              "Monitoring"
            ],
            "summary": "Получить онлайн данные мастера",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestMasterOnline"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestMasterOnline"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestMasterOnline"
                    }
                  }
                }
              }
            }
          }
        },
        "/rest/status": {
          "get": {
            "tags": [
              "Rest"
            ],
            "summary": "Получить cтатус rest сервера",
            "parameters": [
              {
                "name": "key",
                "in": "query",
                "required": true,
                "schema": {
                  "type": "string"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/servers/GameServerRegistration": {
          "post": {
            "tags": [
              "Servers"
            ],
            "summary": "Регистрация игровых серверов",
            "requestBody": {
              "description": "модель сервера",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/GameServerStatusModel"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GameServerStatusModel"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GameServerStatusModel"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/GameServerStatusModel"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/servers/gameServersFullInfo": {
          "get": {
            "tags": [
              "Servers"
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/GameServer"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/GameServer"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/GameServer"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/servers/getProxy": {
          "get": {
            "tags": [
              "Servers"
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "string"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "string"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        },
        "/servers/gameServersAddresses": {
          "get": {
            "tags": [
              "Servers"
            ],
            "summary": "Получение ip адресов гейм серверов",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/servers/GameServerPing": {
          "post": {
            "tags": [
              "Servers"
            ],
            "summary": "Установка клиентов пингов до игровых серверов",
            "requestBody": {
              "description": "данные пингов",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "данные пингов"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "данные пингов"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "данные пингов"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "данные пингов"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/servers/reconnectInfo": {
          "get": {
            "tags": [
              "Servers"
            ],
            "summary": "Получить информацию о возможном реконнекте",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestReconnectData"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestReconnectData"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestReconnectData"
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/{trigger}/{count}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение статистики игроков по триггеру",
            "parameters": [
              {
                "name": "trigger",
                "in": "path",
                "description": "название триггера",
                "required": true,
                "schema": {
                  "type": "string",
                  "description": "название триггера",
                  "nullable": true
                }
              },
              {
                "name": "count",
                "in": "path",
                "description": "кол-во игроков",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "кол-во игроков",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticTriggerItem"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticTriggerItem"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticTriggerItem"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/{trigger}/sum": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение суммы срабатываний триггера по имени",
            "parameters": [
              {
                "name": "trigger",
                "in": "path",
                "description": "имя тригера",
                "required": true,
                "schema": {
                  "type": "string",
                  "description": "имя тригера",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "integer",
                      "format": "int64"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "integer",
                      "format": "int64"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "integer",
                      "format": "int64"
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/server/{trigger}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение статистики по серверному триггеру",
            "parameters": [
              {
                "name": "trigger",
                "in": "path",
                "description": "название триггера",
                "required": true,
                "schema": {
                  "type": "string",
                  "description": "название триггера",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "integer",
                      "format": "int64"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "integer",
                      "format": "int64"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "integer",
                      "format": "int64"
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/kdratio/{count}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение kill/death статистики игроков",
            "parameters": [
              {
                "name": "count",
                "in": "path",
                "description": "кол-во игроков",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "кол-во игроков",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticRatioItem"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticRatioItem"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticRatioItem"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/winrate/{count}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение winrate статистики игроков",
            "parameters": [
              {
                "name": "count",
                "in": "path",
                "description": "кол-во игроков",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "кол-во игроков",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticRatioItem"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticRatioItem"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticRatioItem"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/mapsrating": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение топ мультиплеерных карт",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticItem"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticItem"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticItem"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/matches/countries": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение статистики матчей по странам",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestStatisticCountries"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestStatisticCountries"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestStatisticCountries"
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/matches/specs": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение статистики матчей по специализациям",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticItem"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticItem"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestStatisticItem"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/matches/teamsides": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение статистики матчей по сторонам команд",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestStatisticTeamSides"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestStatisticTeamSides"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestStatisticTeamSides"
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/personal/{marketId}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение персональной статистики игрока",
            "parameters": [
              {
                "name": "marketId",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "string",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestUserPersonalStatistic"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestUserPersonalStatistic"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestUserPersonalStatistic"
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/topshort/{start}/{end}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение топ игроков по рейтингу (упрощенный)",
            "parameters": [
              {
                "name": "start",
                "in": "path",
                "description": "",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "",
                  "format": "int32",
                  "default": 0
                }
              },
              {
                "name": "end",
                "in": "path",
                "description": "",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "",
                  "format": "int32",
                  "default": 100
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RatingShort"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RatingShort"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RatingShort"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/statistic/leaderboard/{count}": {
          "get": {
            "tags": [
              "Statistic"
            ],
            "summary": "Получение лидерборда",
            "parameters": [
              {
                "name": "count",
                "in": "path",
                "description": "кол-во игроков",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "кол-во игроков",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestUserInfo"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestUserInfo"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestUserInfo"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/triggerList": {
          "get": {
            "tags": [
              "TriggerList"
            ],
            "summary": "Получение списка всех триггеров",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          },
          "post": {
            "tags": [
              "TriggerList"
            ],
            "summary": "Добавляет новые триггеры в список",
            "requestBody": {
              "description": "список триггеров для добавления",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "список триггеров для добавления"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "список триггеров для добавления"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "список триггеров для добавления"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "список триггеров для добавления"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/triggerList/serverTriggers": {
          "post": {
            "tags": [
              "TriggerList"
            ],
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    }
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    }
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    }
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    }
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/user/{userId}": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Получение информации пользователя по id",
            "parameters": [
              {
                "name": "market",
                "in": "query",
                "description": "флаг маркет id",
                "schema": {
                  "type": "boolean",
                  "description": "флаг маркет id"
                }
              },
              {
                "name": "steam",
                "in": "query",
                "schema": {
                  "type": "boolean"
                }
              },
              {
                "name": "vk",
                "in": "query",
                "schema": {
                  "type": "boolean"
                }
              },
              {
                "name": "userId",
                "in": "path",
                "description": "id пользователя",
                "required": true,
                "schema": {
                  "type": "string",
                  "description": "id пользователя",
                  "nullable": true
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "$ref": "#/components/schemas/RestUserInfo"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestUserInfo"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "$ref": "#/components/schemas/RestUserInfo"
                    }
                  }
                }
              }
            }
          }
        },
        "/user": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Получение информации нескольких пользователей по списку id",
            "parameters": [
              {
                "name": "ids",
                "in": "query",
                "description": "id пользователей",
                "schema": {
                  "type": "string",
                  "description": "id пользователей",
                  "nullable": true
                }
              },
              {
                "name": "market",
                "in": "query",
                "description": "флаг маркет id",
                "schema": {
                  "type": "boolean",
                  "description": "флаг маркет id"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestUserInfo"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestUserInfo"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/RestUserInfo"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/customization": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Устанавливает кастомизацию юзера",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "модель кастомизации юзера",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "модель кастомизации юзера"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "модель кастомизации юзера"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "модель кастомизации юзера"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "модель кастомизации юзера"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/triggers": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Получение значения триггеров по имени",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              },
              {
                "name": "names",
                "in": "query",
                "description": "название триггеров",
                "required": true,
                "schema": {
                  "type": "string",
                  "description": "название триггеров"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          },
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Инкремент триггеров юзера",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "триггеры",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "триггеры"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "триггеры"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "триггеры"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "триггеры"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/user/{userId}/ab": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "integer",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/triggers/mission": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Инкремент триггеров юзера за прохождение миссий",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "данные прохождения миссии",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/MissionCompleteStatus"
                    },
                    "description": "данные прохождения миссии"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/MissionCompleteStatus"
                    },
                    "description": "данные прохождения миссии"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/MissionCompleteStatus"
                    },
                    "description": "данные прохождения миссии"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "object",
                    "additionalProperties": {
                      "$ref": "#/components/schemas/MissionCompleteStatus"
                    },
                    "description": "данные прохождения миссии"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/user/{userId}/triggers/campaign": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Инкремент триггеров юзера за прохождение кампании",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              },
              {
                "name": "uid",
                "in": "query",
                "description": "uid кампании",
                "required": true,
                "schema": {
                  "type": "string",
                  "description": "uid кампании"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/user/{userId}/prestige": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Апдейт юзером престижа, возможен по достижению максимального уровня",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "юзер ид",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "юзер ид",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "boolean"
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/triggers/all": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Получение всех триггеров для юзера",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/triggers/medals": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Получение всех медалей-триггеров для юзера",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "object",
                      "additionalProperties": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/items": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Получить все айтемы юзера",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/last_fights": {
          "get": {
            "tags": [
              "UserInfo"
            ],
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "integer",
                  "format": "int32"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/items/add": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Дать юзеру список айтемов",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "id айтемов",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/items/check": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Определить должен ли юзер владеть айтемами",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id юзера",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id юзера",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "id айтемов",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                },
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                },
                "text/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "format": "int32"
                    },
                    "description": "id айтемов"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "text/plain": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  },
                  "text/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "type": "integer",
                        "format": "int32"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "/user/{userId}/report": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Отправить репорт/похвалу на игрока",
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "description": "id игрока",
                "required": true,
                "schema": {
                  "type": "integer",
                  "description": "id игрока",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "description": "данные",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserReport"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserReport"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserReport"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserReport"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/user/{userId}/report/auto": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "parameters": [
              {
                "name": "userId",
                "in": "path",
                "required": true,
                "schema": {
                  "type": "integer",
                  "format": "int32"
                }
              }
            ],
            "requestBody": {
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAutoReport"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAutoReport"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAutoReport"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestAutoReport"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        },
        "/user/fight-history": {
          "post": {
            "tags": [
              "UserInfo"
            ],
            "summary": "Отправить историю боя по каждому юзеру",
            "requestBody": {
              "description": "данные по каждому юзеру",
              "content": {
                "application/json-patch+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserFightHistory"
                  }
                },
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserFightHistory"
                  }
                },
                "text/json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserFightHistory"
                  }
                },
                "application/*+json": {
                  "schema": {
                    "$ref": "#/components/schemas/RestUserFightHistory"
                  }
                }
              },
              "required": true
            },
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        }
      },
      "components": {
        "schemas": {
          "GameMarketType": {
            "enum": [
              0,
              1,
              2,
              3,
              255
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestUserInfo": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "steamId": {
                "type": "string",
                "nullable": true,
                "deprecated": true
              },
              "customization": {
                "type": "object",
                "additionalProperties": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "level": {
                "type": "integer",
                "format": "int32"
              },
              "prestigeLevel": {
                "type": "integer",
                "format": "int32"
              },
              "rating": {
                "type": "number",
                "format": "float"
              },
              "rank": {
                "type": "integer",
                "format": "int32"
              },
              "ratingGamesCount": {
                "type": "integer",
                "format": "int32"
              },
              "marketId": {
                "type": "string",
                "nullable": true
              },
              "marketType": {
                "$ref": "#/components/schemas/GameMarketType"
              }
            },
            "additionalProperties": false
          },
          "RestAdminUserInfo": {
            "type": "object",
            "properties": {
              "userInfo": {
                "$ref": "#/components/schemas/RestUserInfo"
              },
              "createDate": {
                "type": "integer",
                "format": "int64"
              },
              "login": {
                "type": "string",
                "nullable": true
              },
              "ban": {
                "type": "integer",
                "format": "int64"
              },
              "vacBan": {
                "type": "boolean"
              },
              "banCount": {
                "type": "integer",
                "format": "int32"
              },
              "banExpired": {
                "type": "boolean"
              },
              "userReports": {
                "type": "object",
                "additionalProperties": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "systemReports": {
                "type": "object",
                "additionalProperties": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "ownerType": {
                "type": "string",
                "nullable": true
              },
              "ownsApps": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "ModelBanHistory": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int64"
              },
              "date": {
                "type": "integer",
                "format": "int64"
              },
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "moderatorId": {
                "type": "string",
                "nullable": true
              },
              "dateUntil": {
                "type": "integer",
                "format": "int64"
              },
              "reasonType": {
                "type": "integer",
                "format": "int32"
              },
              "message": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "ModelBanHistoryRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/ModelBanHistory"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "BanReason": {
            "enum": [
              0,
              1,
              2,
              3,
              250,
              255
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestAdminBanData": {
            "type": "object",
            "properties": {
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "time": {
                "type": "integer",
                "format": "int64"
              },
              "reasonType": {
                "$ref": "#/components/schemas/BanReason"
              },
              "message": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestAdminUserInfoRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestAdminUserInfo"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "ReportType": {
            "enum": [
              0,
              1,
              2,
              3,
              4,
              255
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestAdminUserReport": {
            "type": "object",
            "properties": {
              "date": {
                "type": "integer",
                "format": "int64"
              },
              "reporterId": {
                "type": "integer",
                "format": "int32"
              },
              "reportType": {
                "$ref": "#/components/schemas/ReportType"
              },
              "message": {
                "type": "string",
                "nullable": true
              },
              "fightId": {
                "type": "integer",
                "format": "int64"
              }
            },
            "additionalProperties": false
          },
          "RestAdminUserReportRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestAdminUserReport"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "AutoReportReason": {
            "enum": [
              0,
              1,
              2,
              3,
              4,
              100,
              101
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestAdminSystemReport": {
            "type": "object",
            "properties": {
              "date": {
                "type": "integer",
                "format": "int64"
              },
              "reportType": {
                "$ref": "#/components/schemas/AutoReportReason"
              },
              "message": {
                "type": "string",
                "nullable": true
              },
              "fightId": {
                "type": "integer",
                "format": "int64"
              }
            },
            "additionalProperties": false
          },
          "RestAdminSystemReportRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestAdminSystemReport"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "RestAdminModeratorHistory": {
            "type": "object",
            "properties": {
              "date": {
                "type": "integer",
                "format": "int64"
              },
              "moderatorId": {
                "type": "string",
                "nullable": true
              },
              "url": {
                "type": "string",
                "nullable": true
              },
              "data": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestAdminModeratorHistoryRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestAdminModeratorHistory"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "LobbyType": {
            "enum": [
              0,
              1,
              2,
              3
            ],
            "type": "integer",
            "format": "int32"
          },
          "FightEndType": {
            "enum": [
              0,
              1,
              2,
              3
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestAdminFightHistory": {
            "type": "object",
            "properties": {
              "date": {
                "type": "integer",
                "format": "int64"
              },
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "fightType": {
                "$ref": "#/components/schemas/LobbyType"
              },
              "fightEndType": {
                "$ref": "#/components/schemas/FightEndType"
              },
              "fightId": {
                "type": "integer",
                "format": "int64"
              }
            },
            "additionalProperties": false
          },
          "RestAdminFightHistoryRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestAdminFightHistory"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "RestAdminBanHistory": {
            "type": "object",
            "properties": {
              "date": {
                "type": "integer",
                "format": "int64"
              },
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "moderatorId": {
                "type": "string",
                "nullable": true
              },
              "dateUntil": {
                "type": "integer",
                "format": "int64"
              },
              "banReason": {
                "$ref": "#/components/schemas/BanReason"
              },
              "message": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestAdminBanHistoryRestPaginatedResult": {
            "type": "object",
            "properties": {
              "page": {
                "type": "integer",
                "format": "int32"
              },
              "pageSize": {
                "type": "integer",
                "format": "int32"
              },
              "totalCount": {
                "type": "integer",
                "format": "int32"
              },
              "items": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestAdminBanHistory"
                },
                "nullable": true
              },
              "totalPages": {
                "type": "integer",
                "format": "int32",
                "readOnly": true
              },
              "hasPreviousPage": {
                "type": "boolean",
                "readOnly": true
              },
              "hasNextPage": {
                "type": "boolean",
                "readOnly": true
              }
            },
            "additionalProperties": false
          },
          "RestAuthRequest": {
            "type": "object",
            "properties": {
              "login": {
                "type": "string",
                "nullable": true
              },
              "password": {
                "type": "string",
                "nullable": true
              },
              "steamId": {
                "type": "string",
                "nullable": true
              },
              "gogId": {
                "type": "string",
                "nullable": true
              },
              "appId": {
                "type": "string",
                "nullable": true
              },
              "vkId": {
                "type": "string",
                "nullable": true
              },
              "gameVersion": {
                "type": "string",
                "nullable": true
              },
              "ticketHex": {
                "type": "string",
                "nullable": true
              },
              "oldToken": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestReconnectData": {
            "type": "object",
            "properties": {
              "ip": {
                "type": "string",
                "nullable": true
              },
              "port": {
                "type": "integer",
                "format": "int32"
              },
              "proxyPort": {
                "type": "integer",
                "format": "int32"
              },
              "instanceId": {
                "type": "integer",
                "format": "int32"
              },
              "time": {
                "type": "integer",
                "format": "int64"
              },
              "deckHash": {
                "type": "integer",
                "format": "int32"
              },
              "scenarioHash": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestAuthResponse": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "accessLevel": {
                "type": "integer",
                "format": "int32"
              },
              "token": {
                "type": "string",
                "nullable": true
              },
              "userInfo": {
                "$ref": "#/components/schemas/RestUserInfo"
              },
              "reconnectData": {
                "$ref": "#/components/schemas/RestReconnectData"
              },
              "allowedLobbies": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestAuthRequestV2": {
            "type": "object",
            "properties": {
              "login": {
                "type": "string",
                "nullable": true
              },
              "password": {
                "type": "string",
                "nullable": true
              },
              "marketId": {
                "type": "string",
                "nullable": true
              },
              "gameVersion": {
                "type": "string",
                "nullable": true
              },
              "ticketHex": {
                "type": "string",
                "nullable": true
              },
              "oldToken": {
                "type": "string",
                "nullable": true
              },
              "marketType": {
                "$ref": "#/components/schemas/GameMarketType"
              },
              "appId": {
                "type": "string",
                "nullable": true
              },
              "dlc": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "ip": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestMapInfo": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "sceneName": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestTriggerConfig": {
            "type": "object",
            "properties": {
              "expPointsWin": {
                "type": "integer",
                "format": "int32"
              },
              "expPointsLoss": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "RestSentryConfig": {
            "type": "object",
            "properties": {
              "dsn": {
                "type": "string",
                "nullable": true
              },
              "debug": {
                "type": "boolean"
              },
              "tracesSampleRate": {
                "type": "number",
                "format": "float"
              },
              "release": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "TimersData": {
            "type": "object",
            "properties": {
              "allPlayersLoadedDelay": {
                "type": "integer",
                "format": "int32"
              },
              "awaitingPlayersDelay": {
                "type": "integer",
                "format": "int32"
              },
              "deploymentPhase": {
                "type": "integer",
                "format": "int32"
              },
              "gameModeMaxTime": {
                "type": "integer",
                "format": "int32"
              },
              "roomTechnicalLifetime": {
                "type": "integer",
                "format": "int32"
              },
              "reconnectionPossibility": {
                "type": "integer",
                "format": "int32"
              },
              "endFightCloseInstanceDelay": {
                "type": "integer",
                "format": "int32"
              },
              "votingTime": {
                "type": "integer",
                "format": "int32"
              },
              "deckChoosingTime": {
                "type": "integer",
                "format": "int32"
              },
              "suddenDeathTime": {
                "type": "integer",
                "format": "int32"
              },
              "sendInGamePlayersStatistic": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "RestMedalData": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "experience": {
                "type": "integer",
                "format": "int32"
              },
              "disabled": {
                "type": "boolean"
              },
              "function": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestMedalsConfig": {
            "type": "object",
            "properties": {
              "commonMedals": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestMedalData"
                },
                "nullable": true
              },
              "unitMedals": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestMedalData"
                },
                "nullable": true
              },
              "unitRoleMedals": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestMedalData"
                },
                "nullable": true
              },
              "unitsTotalMedals": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestMedalData"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "Int32Int32ValueTuple": {
            "type": "object",
            "additionalProperties": false
          },
          "VictoryConditionsWarGoalsData": {
            "type": "object",
            "properties": {
              "conquestPoints": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "destructionPoints": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "phasePointsMultiplier": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "victoryDiffPoints": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/Int32Int32ValueTuple"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "VictoryConditionsConquestData": {
            "type": "object",
            "properties": {
              "victoryDiffPercentage": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/Int32Int32ValueTuple"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "VictoryConditionsDestructionData": {
            "type": "object",
            "properties": {
              "victoryDiffPoints": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/Int32Int32ValueTuple"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestGameModesConfig": {
            "type": "object",
            "properties": {
              "xpMultipliersByLobbyType": {
                "type": "object",
                "additionalProperties": {
                  "type": "number",
                  "format": "float"
                },
                "nullable": true
              },
              "xpMultipliersByVictoryType": {
                "type": "object",
                "additionalProperties": {
                  "type": "number",
                  "format": "float"
                },
                "nullable": true
              },
              "victoryConditionsWarGoals": {
                "$ref": "#/components/schemas/VictoryConditionsWarGoalsData"
              },
              "victoryConditionsConquest": {
                "$ref": "#/components/schemas/VictoryConditionsConquestData"
              },
              "victoryConditionsDestruction": {
                "$ref": "#/components/schemas/VictoryConditionsDestructionData"
              }
            },
            "additionalProperties": false
          },
          "RestDatabaseUnitData": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "type": {
                "type": "integer",
                "format": "int32"
              },
              "role": {
                "type": "integer",
                "format": "int32"
              },
              "category": {
                "type": "integer",
                "format": "int32"
              },
              "countryId": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "RestDatabaseConfig": {
            "type": "object",
            "properties": {
              "units": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/RestDatabaseUnitData"
                },
                "nullable": true
              },
              "hash": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "Map": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "sceneName": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "TankMapCell": {
            "type": "object",
            "properties": {
              "x": {
                "type": "integer",
                "format": "int32"
              },
              "y": {
                "type": "integer",
                "format": "int32"
              },
              "type": {
                "type": "integer",
                "format": "int32"
              },
              "health": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "TankMap": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "nullable": true
              },
              "cell": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/TankMapCell"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestServerConfig": {
            "type": "object",
            "properties": {
              "initialPort": {
                "type": "integer",
                "format": "int32"
              },
              "netFrameRate": {
                "type": "integer",
                "format": "int32"
              },
              "minRequiredBuildVersion": {
                "type": "string",
                "nullable": true
              },
              "defaultIncomePerMinute": {
                "type": "integer",
                "format": "int32"
              },
              "timers": {
                "$ref": "#/components/schemas/TimersData"
              },
              "medals": {
                "$ref": "#/components/schemas/RestMedalsConfig"
              },
              "gameModes": {
                "$ref": "#/components/schemas/RestGameModesConfig"
              },
              "database": {
                "$ref": "#/components/schemas/RestDatabaseConfig"
              },
              "maps": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/Map"
                },
                "nullable": true
              },
              "mapPool": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/Map"
                },
                "nullable": true
              },
              "tankMiniGameMaps": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/TankMap"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestMissionExpData": {
            "type": "object",
            "properties": {
              "expByDifficulty": {
                "type": "object",
                "additionalProperties": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "expByMedal": {
                "type": "object",
                "additionalProperties": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestUserProgressConfig": {
            "type": "object",
            "properties": {
              "levels": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "nationLevels": {
                "type": "object",
                "additionalProperties": {
                  "type": "array",
                  "items": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "nullable": true
              },
              "specLevels": {
                "type": "object",
                "additionalProperties": {
                  "type": "array",
                  "items": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "nullable": true
              },
              "combinedSpecLevels": {
                "type": "object",
                "additionalProperties": {
                  "type": "array",
                  "items": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "nullable": true
              },
              "missionLevels": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/RestMissionExpData"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "NetItemType": {
            "enum": [
              0,
              1,
              2,
              3,
              4,
              5,
              20
            ],
            "type": "integer",
            "format": "int32"
          },
          "NetItemGrade": {
            "enum": [
              0,
              10,
              20,
              30,
              40,
              100,
              200
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestClientItem": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "type": {
                "$ref": "#/components/schemas/NetItemType"
              },
              "grade": {
                "$ref": "#/components/schemas/NetItemGrade"
              },
              "triggers": {
                "type": "object",
                "additionalProperties": {
                  "type": "integer",
                  "format": "int32"
                },
                "nullable": true
              },
              "disabled": {
                "type": "boolean"
              },
              "free": {
                "type": "boolean"
              }
            },
            "additionalProperties": false
          },
          "RestContainerDLC": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "data": {
                "type": "object",
                "additionalProperties": {
                  "type": "array",
                  "items": {
                    "type": "integer",
                    "format": "int32"
                  }
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "LobbyServer": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "port": {
                "type": "integer",
                "format": "int32"
              },
              "ip": {
                "type": "string",
                "nullable": true
              },
              "proxyPort": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "ModelLobbyInfo": {
            "type": "object",
            "additionalProperties": false
          },
          "ModelLobbyList": {
            "type": "object",
            "properties": {
              "servers": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/LobbyServer"
                },
                "nullable": true
              },
              "lobbies": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/ModelLobbyInfo"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "ServerHealth": {
            "type": "object",
            "properties": {
              "host": {
                "type": "string",
                "nullable": true
              },
              "cores": {
                "type": "integer",
                "format": "int32"
              },
              "totalMemory": {
                "type": "number",
                "format": "double"
              },
              "totalDisk": {
                "type": "string",
                "nullable": true
              },
              "cpu": {
                "type": "number",
                "format": "double"
              },
              "memory": {
                "type": "number",
                "format": "double"
              },
              "disk": {
                "type": "string",
                "nullable": true
              },
              "network": {
                "type": "number",
                "format": "double"
              },
              "uptime": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestServerStatus": {
            "type": "object",
            "properties": {
              "version": {
                "type": "string",
                "nullable": true
              },
              "port": {
                "type": "integer",
                "format": "int32"
              },
              "instanceCount": {
                "type": "integer",
                "format": "int32"
              },
              "playerCount": {
                "type": "integer",
                "format": "int32"
              },
              "serverLoad": {
                "type": "number",
                "format": "float"
              }
            },
            "additionalProperties": false
          },
          "RestMasterOnline": {
            "type": "object",
            "properties": {
              "online": {
                "type": "integer",
                "format": "int32"
              },
              "inLobby": {
                "type": "integer",
                "format": "int32"
              },
              "inSearching": {
                "type": "integer",
                "format": "int32"
              },
              "teamMapping": {
                "type": "integer",
                "format": "int32"
              },
              "inBattle": {
                "type": "integer",
                "format": "int32"
              },
              "instances": {
                "type": "integer",
                "format": "int32"
              },
              "statusCode": {
                "type": "integer",
                "format": "int32"
              },
              "statusDate": {
                "type": "integer",
                "format": "int64"
              },
              "statusCustomMessage": {
                "type": "string",
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "GameServerStatusModel": {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "nullable": true
              },
              "b": {
                "type": "integer",
                "format": "int32"
              },
              "c": {
                "type": "boolean"
              },
              "d": {
                "type": "number",
                "format": "float"
              },
              "e": {
                "type": "integer",
                "format": "int32"
              },
              "f": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "GameServer": {
            "type": "object",
            "additionalProperties": false
          },
          "RestStatisticTriggerItem": {
            "type": "object",
            "properties": {
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "userName": {
                "type": "string",
                "nullable": true
              },
              "count": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "RestStatisticRatioItem": {
            "type": "object",
            "properties": {
              "userName": {
                "type": "string",
                "nullable": true
              },
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "ratio": {
                "type": "number",
                "format": "float"
              }
            },
            "additionalProperties": false
          },
          "RestStatisticItem": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "format": "int32"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "count": {
                "type": "integer",
                "format": "int64"
              }
            },
            "additionalProperties": false
          },
          "RestStatisticCountries": {
            "type": "object",
            "properties": {
              "updateDate": {
                "type": "string",
                "format": "date-time"
              },
              "matchesCount": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestStatisticItem"
                },
                "nullable": true
              },
              "winsCount": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestStatisticItem"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestStatisticTeamSideItem": {
            "type": "object",
            "properties": {
              "map": {
                "type": "string",
                "nullable": true
              },
              "winData": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestStatisticItem"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestStatisticTeamSides": {
            "type": "object",
            "properties": {
              "updateDate": {
                "type": "string",
                "format": "date-time"
              },
              "data": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestStatisticTeamSideItem"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestUserPersonalStatisticByLobbyType": {
            "type": "object",
            "properties": {
              "kdRatio": {
                "type": "number",
                "format": "float"
              },
              "fightsCount": {
                "type": "integer",
                "format": "int32"
              },
              "winsCount": {
                "type": "integer",
                "format": "int32"
              },
              "losesCount": {
                "type": "integer",
                "format": "int32"
              },
              "leavesCount": {
                "type": "integer",
                "format": "int32"
              },
              "killsCount": {
                "type": "integer",
                "format": "int32"
              },
              "deathsCount": {
                "type": "integer",
                "format": "int32"
              },
              "totalMatchTimeSec": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "RestStatisticContainer": {
            "type": "object",
            "properties": {
              "updateDate": {
                "type": "string",
                "format": "date-time"
              },
              "data": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestStatisticItem"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          },
          "RestUserPersonalStatistic": {
            "type": "object",
            "properties": {
              "updateDate": {
                "type": "string",
                "format": "date-time"
              },
              "name": {
                "type": "string",
                "nullable": true
              },
              "level": {
                "type": "integer",
                "format": "int32"
              },
              "experienceCount": {
                "type": "integer",
                "format": "int32"
              },
              "statisticByLobbyType": {
                "type": "object",
                "additionalProperties": {
                  "$ref": "#/components/schemas/RestUserPersonalStatisticByLobbyType"
                },
                "nullable": true
              },
              "killsFriendlyFireCount": {
                "type": "integer",
                "format": "int32"
              },
              "deathsByFriendlyFireCount": {
                "type": "integer",
                "format": "int32"
              },
              "capturedZonesCount": {
                "type": "integer",
                "format": "int32"
              },
              "mapsPlayCount": {
                "$ref": "#/components/schemas/RestStatisticContainer"
              },
              "totalMatchSearchingTimeSec": {
                "type": "integer",
                "format": "int32"
              },
              "supplyPointsConsumed": {
                "type": "integer",
                "format": "int32"
              },
              "supplyCapturedCount": {
                "type": "integer",
                "format": "int32"
              },
              "supplyCapturedByEnemyCount": {
                "type": "integer",
                "format": "int32"
              },
              "supplyAirdroppedCount": {
                "type": "integer",
                "format": "int32"
              }
            },
            "additionalProperties": false
          },
          "RatingShort": {
            "type": "object",
            "additionalProperties": false
          },
          "MissionCompleteStatus": {
            "enum": [
              0,
              1,
              2,
              4,
              16,
              32,
              64
            ],
            "type": "integer",
            "format": "int32"
          },
          "RestUserReport": {
            "type": "object",
            "properties": {
              "reportType": {
                "$ref": "#/components/schemas/ReportType"
              },
              "message": {
                "type": "string",
                "nullable": true
              },
              "fightId": {
                "type": "integer",
                "format": "int64"
              }
            },
            "additionalProperties": false
          },
          "RestAutoReport": {
            "type": "object",
            "properties": {
              "reportType": {
                "$ref": "#/components/schemas/AutoReportReason"
              },
              "message": {
                "type": "string",
                "nullable": true
              },
              "fightId": {
                "type": "integer",
                "format": "int64"
              }
            },
            "additionalProperties": false
          },
          "RestUserFightHistoryItem": {
            "type": "object",
            "properties": {
              "userId": {
                "type": "integer",
                "format": "int32"
              },
              "fightEndType": {
                "$ref": "#/components/schemas/FightEndType"
              }
            },
            "additionalProperties": false
          },
          "RestUserFightHistory": {
            "type": "object",
            "properties": {
              "fightId": {
                "type": "integer",
                "format": "int64"
              },
              "lobbyType": {
                "$ref": "#/components/schemas/LobbyType"
              },
              "userData": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/RestUserFightHistoryItem"
                },
                "nullable": true
              }
            },
            "additionalProperties": false
          }
        },
        "securitySchemes": {
          "Authorization": {
            "type": "apiKey",
            "description": "JWT Authorization header using the Bearer scheme.\r\n                      Example: '12345abcdef'",
            "name": "adminToken",
            "in": "header"
          }
        }
      },
      "security": [
        {
          "Authorization": [ ]
        }
      ]
    },
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  });

  //</editor-fold>
};
