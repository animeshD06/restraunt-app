# Restaurant App DBMS Project Improvements

## Overview

This project already has a good foundation for a DBMS mini-project. The current codebase includes:

- A React frontend for menu viewing, order placement, billing, and reports
- An Express backend with REST APIs
- A relational database structure using `categories`, `menu_items`, `orders`, and `order_items`
- SQL joins, transactions, and report queries

To make the project stronger as a **DBMS project**, the next step is to expand the database design, enforce stronger constraints, and add more database-centered features.

## Current Strengths

- The schema is normalized into multiple related tables
- Foreign keys are used between orders and order items
- Transactions are used while creating and deleting orders
- Reports are generated using joins and aggregate queries
- The frontend already demonstrates practical use of the database

## Major Improvements

### 1. Add More Real-World Entities

Right now the schema mainly includes:

- `categories`
- `menu_items`
- `orders`
- `order_items`

For a stronger DBMS project, add the following tables:

- `customers`
- `employees`
- `restaurant_tables`
- `payments`
- `reservations`
- `inventory`
- `ingredients`
- `menu_item_ingredients`

This will help demonstrate:

- one-to-many relationships
- many-to-many relationships
- better normalization
- more realistic business logic

### 2. Enforce Constraints at the Database Level

Some business rules are currently handled loosely in application code. A stronger DBMS design should enforce rules directly in the database.

Recommended constraints:

- `price > 0`
- `quantity > 0`
- `table_number > 0`
- allowed values for `order status`
- `NOT NULL` on required fields
- `UNIQUE` on category names and possibly menu item names
- foreign key constraints on all related tables

Examples:

- `orders.status` should allow only `pending`, `preparing`, `served`, `paid`, or `cancelled`
- `menu_items.available` should default to true
- `payments.amount` should always be positive

Why this matters:

- improves data integrity
- prevents invalid records
- makes the project look more database-oriented

### 3. Add a Separate Payments Table

At present, revenue is inferred from orders marked as `paid`. This works, but it is not ideal database design.

Add a `payments` table with fields like:

- `id`
- `order_id`
- `amount`
- `payment_method`
- `payment_status`
- `paid_at`

Benefits:

- revenue reports become more accurate
- supports cash, card, and UPI
- supports partial or split payments later
- gives a better transaction history

### 4. Preserve Historical Prices

The current bill calculation uses the current `menu_items.price`. If a menu price changes later, old bills may become incorrect.

Improvement:

- add `unit_price_at_order` in `order_items`

Benefits:

- old bills remain correct
- revenue history remains consistent
- shows understanding of historical data management

### 5. Add Indexes

Indexes should be added for performance and for demonstrating DBMS knowledge.

Recommended indexes:

- `menu_items(category_id)`
- `orders(status)`
- `orders(created_at)`
- `order_items(order_id)`
- `order_items(menu_item_id)`
- `payments(order_id)`
- `reservations(table_id, reservation_time)`

Benefits:

- faster joins
- faster filtering
- better performance for reports

Even with a small dataset, indexing is an important DBMS concept to include in the project report.

## Current Design Gaps

### 1. Mixed Database Story

The project has:

- a MySQL schema in `backend/setup.sql`
- a SQLite implementation in `backend/setup-db.js`

This creates confusion in the project narrative.

Recommended improvement:

- choose one DBMS clearly for the final submission
- or document that the design is for MySQL and the demo runs on SQLite

### 2. Limited Validation During Order Creation

The backend checks whether table number and items exist, but does not strongly validate:

- whether quantity is valid
- whether a menu item exists
- whether the item is available
- whether duplicate items should be merged

Recommended improvement:

- validate input before insert
- reject unavailable menu items
- ensure quantity is positive
- check that all referenced menu items exist

### 3. Manual Deletion Despite Cascade Support

The code deletes `order_items` manually before deleting `orders`, even though `ON DELETE CASCADE` already exists in the schema.

Recommended improvement:

- rely on cascade delete properly
- simplify backend deletion logic

This makes the schema design look cleaner and more intentional.

### 4. Reports Are Too Limited

Current reports include:

- daily revenue
- most popular items

This is a good start, but for a DBMS project more analytical queries would improve the submission.

## Recommended New Features

### 1. Inventory Management

Add tables such as:

- `ingredients`
- `inventory`
- `purchase_history`
- `menu_item_ingredients`

Possible features:

- stock quantity tracking
- ingredient usage per order
- low-stock alerts
- reorder reports

### 2. Reservation System

Add tables such as:

- `customers`
- `restaurant_tables`
- `reservations`

Possible features:

- customer table booking
- reservation time slots
- occupancy tracking
- booking history

### 3. Employee Management

Add:

- `employees`
- `roles`
- `shift_logs`

Possible features:

- assign waiter to each order
- track which staff handled orders
- report staff performance

### 4. Payment and Billing Module

Add:

- payment records
- tax calculation fields
- discount support
- payment mode tracking

Possible features:

- split bill
- GST/service tax
- coupon or discount support
- payment receipt history

### 5. Audit and History Tables

Add history tables such as:

- `menu_audit_log`
- `order_status_history`
- `payment_audit`

Possible uses:

- track status changes over time
- track who updated records
- support better reporting and accountability

This is especially useful for explaining advanced DBMS concepts in viva.

## Recommended Advanced Reports

To make the project more impressive, add more SQL-based reports:

- monthly revenue report
- most profitable menu items
- most ordered category
- peak ordering hours
- unpaid orders report
- cancelled orders report
- table occupancy report
- reservation utilization report
- low-stock inventory report
- top customers by spending

These reports can demonstrate:

- grouping
- joins
- aggregates
- date functions
- sorting
- filtering

## Suggested Improved Schema

An upgraded version of the database could include:

- `customers(id, name, phone, email)`
- `employees(id, name, role_id, phone)`
- `roles(id, role_name)`
- `restaurant_tables(id, table_number, capacity, status)`
- `categories(id, name)`
- `menu_items(id, name, price, category_id, available)`
- `ingredients(id, name, unit, stock_quantity, reorder_level)`
- `menu_item_ingredients(menu_item_id, ingredient_id, quantity_required)`
- `orders(id, customer_id, employee_id, table_id, status, created_at)`
- `order_items(id, order_id, menu_item_id, quantity, unit_price_at_order)`
- `payments(id, order_id, amount, payment_method, payment_status, paid_at)`
- `reservations(id, customer_id, table_id, reservation_time, guest_count, status)`
- `order_status_history(id, order_id, old_status, new_status, changed_at)`

## Implementation Priorities

If this project is being improved in phases, the best order is:

### Phase 1

- add constraints
- add indexes
- store historical item prices
- improve backend validation

### Phase 2

- add payments table
- add customer and table entities
- improve reports

### Phase 3

- add reservations
- add employees
- add inventory management
- add audit logs

## Best Project Positioning

For a DBMS project presentation, this system can be described as:

**Restaurant Management System with order processing, billing, payment tracking, reporting, reservations, and inventory management using relational database design, normalization, constraints, transactions, joins, and analytical SQL queries.**

## Conclusion

This codebase is already a strong starting point, but to make it stand out as a DBMS project, the focus should shift from simple CRUD toward:

- richer schema design
- stronger integrity constraints
- historical data preservation
- more advanced reporting
- additional database modules like payments, reservations, and inventory

These improvements will make the project more realistic, more scalable, and much stronger for academic evaluation.
