# Print Ghar — Backend API (MongoDB Atlas)

Structured Express.js + Mongoose backend for Print Ghar order management system connected to MongoDB Atlas.

## Prerequisites
- Node.js 18+
- npm 9+

## Setup & Running

```bash
cd backend
npm install
npm run seed           # Seed initial master products and sample customer (optional)
npm run dev            # Start dev server with nodemon (http://localhost:3001)
npm start              # Start production server
```

## Project Structure

```
backend/
  src/
    index.js              ← Entry point (Express server + MongoDB connection)
    config/
      db.js               ← Mongoose MongoDB connection manager
      env.js              ← Environment variable loader/validator
    models/
      Customer.js         ← Customer Mongoose schema
      Order.js            ← Order Mongoose schema (items, history, pricing)
      Product.js          ← MasterProduct Mongoose schema
    routes/               ← Route definitions
      orders.js
      customers.js
      products.js
      whatsapp.js
    controllers/          ← Business logic & database operations
      orderController.js
      customerController.js
      productController.js
      whatsappController.js
    middleware/
      auth.js             ← API key authentication middleware
      errorHandler.js     ← Global error handler
    scripts/
      seed.js             ← Database seeder for initial products/customers
    utils/
      logger.js           ← Timestamped logger
  .env                    ← Real environment config with MongoDB Atlas URI
  .env.example            ← Template environment file
  package.json
```

## API Endpoints

| Method | Path                 | Description                    |
|--------|----------------------|--------------------------------|
| GET    | `/health`            | Health & DB connection status  |
| GET    | `/api/orders`        | List orders (supports filters) |
| GET    | `/api/orders/:id`    | Get single order by ID         |
| POST   | `/api/orders`        | Create new order               |
| PUT    | `/api/orders/:id`    | Update existing order          |
| DELETE | `/api/orders/:id`    | Delete order                   |
| GET    | `/api/customers`     | List customers (with search)   |
| GET    | `/api/customers/:id` | Get customer by ID             |
| POST   | `/api/customers`     | Create customer                |
| PUT    | `/api/customers/:id` | Update customer                |
| DELETE | `/api/customers/:id` | Delete customer                |
| GET    | `/api/products`      | List master products           |
| GET    | `/api/products/:id`  | Get product by ID              |
| POST   | `/api/products`      | Create product                 |
| PUT    | `/api/products/:id`  | Update product                 |
| DELETE | `/api/products/:id`  | Delete product                 |
| POST   | `/api/whatsapp/send` | Send WhatsApp template message |

## Database Configuration

Configured in `backend/.env`:
- **Database:** MongoDB Atlas (Cluster0)
- **Database Name:** `print-ghar`
- **Driver:** Mongoose v9.x
