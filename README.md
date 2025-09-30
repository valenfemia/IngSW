# Inventory App — Guía de ejecución y configuración (Paso 4)

Este documento completa la **Tarea 4** de la consigna: agregar README, cambiar el puerto por defecto a **80** y migrar la base de datos desde **SQLite** a **MySQL** o **PostgreSQL** usando variables de entorno. Asumo una app Node.js con `server.js` y `package.json` en la raíz del repo.

> **Importante (Elastic Beanstalk):** en EB **no** fijes el puerto a 80; usá `process.env.PORT` (EB inyecta el puerto que corresponde detrás del ALB). El cambio a 80 aplica para **EC2/local** como _fallback_.

---

## 1) Variables de entorno

Crear un archivo `.env` (o usar parámetros del entorno en cada plataforma) con:

```
# Puerto — usar 80 por defecto fuera de EB
PORT=80

# Elegir uno de los dos dialectos:
DB_DIALECT=mysql           # ó: postgres

# Datos de conexión (ej. RDS/Aurora/RDS Postgres)
DB_HOST=tu-host-db
DB_PORT=3306               # 5432 si usas Postgres
DB_NAME=inventory
DB_USER=app_user
DB_PASSWORD=app_password
```

> En **Elastic Beanstalk**, cargá estas claves en _Configuration → Software → Environment properties_. En **EC2**, podés exportarlas en el `~/.bashrc` o usar un archivo `.env` con `dotenv`.

---

## 2) Dependencias

En el proyecto, agregar Sequelize y el driver correspondiente:

```bash
# MySQL
npm install sequelize mysql2 dotenv

# PostgreSQL (alternativa)
# npm install sequelize pg pg-hstore dotenv
```

---

## 3) Cambios de código

### 3.1 `package.json`

Asegurate de tener scripts estándar:

```json
{
  "scripts": {
    "start": "node server.js",
    "start:dev": "NODE_ENV=development node server.js"
  }
}
```

### 3.2 `server.js` — puerto 80 como default y conexión DB

Ejemplo mínimo (adaptar a tu `server.js` actual):

```js
require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// 1) Puerto — usar PORT del entorno o 80 por defecto (para EC2/local)
const PORT = process.env.PORT ? Number(process.env.PORT) : 80;

// 2) Conexión a DB vía Sequelize
const DIALECT = process.env.DB_DIALECT || 'mysql';   // 'mysql' o 'postgres'
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : (DIALECT === 'postgres' ? 5432 : 3306),
    dialect: DIALECT,
    logging: false
  }
);

// 3) Modelo simple de ejemplo (inventario)
const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  price: { type: DataTypes.DECIMAL(10,2), defaultValue: 0 }
}, { tableName: 'products', timestamps: false });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Endpoints mínimos
app.get('/api/products', async (_req, res) => {
  const items = await Product.findAll({ order: [['id', 'ASC']] });
  res.json(items);
});

app.post('/api/products', async (req, res) => {
  const p = await Product.create(req.body);
  res.status(201).json(p);
});

// 4) Arranque: sincroniza la DB si hace falta
(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); // usar migraciones en producción si preferís
    app.listen(PORT, () => {
      console.log(`Server up on port ${PORT}`);
    });
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
})();
```

> Si tu `server.js` ya tenía rutas/estática, **conserválas** y agregá sólo las partes marcadas: lectura de `.env`, cálculo de `PORT` y la inicialización de Sequelize según tu caso.

---

## 4) Esquema de base de datos

Si preferís crear la tabla manualmente (en vez de `sequelize.sync()`), podés usar:

### MySQL
```sql
CREATE DATABASE IF NOT EXISTS inventory;
USE inventory;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  quantity INT DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0
);
```

### PostgreSQL
```sql
CREATE DATABASE inventory;

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  quantity INT DEFAULT 0,
  price NUMERIC(10,2) DEFAULT 0
);
```

---

## 5) Consideraciones por plataforma

### EC2
- Asegurate de exponer el **puerto 80** en el SG.
- Si el proceso no corre como root, podés preferir **Nginx** como _reverse proxy_ escuchando en 80 y redirigiendo a `localhost:3000` o `localhost:${PORT}`.
- Alternativa avanzada: `setcap 'cap_net_bind_service=+ep' $(which node)` para permitir bind en puertos <1024 (no recomendado en general).

### Elastic Beanstalk (Node.js)
- **No fijes 80**; EB inyecta `PORT`. Configurar `PORT=80` acá rompe health checks.
- Pasar credenciales de DB por _Environment properties_.
- DB recomendada: **RDS** (MySQL/Postgres) en la misma VPC/subredes que tu EB.

### Local
```bash
# Variables locales desde .env
npm install
npm run start
```

---
