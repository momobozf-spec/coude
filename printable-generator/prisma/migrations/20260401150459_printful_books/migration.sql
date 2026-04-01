-- CreateTable
CREATE TABLE "coloring_books" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "child_name" TEXT NOT NULL,
    "child_age" INTEGER,
    "cover_style" TEXT NOT NULL DEFAULT 'classic',
    "cover_color" TEXT NOT NULL DEFAULT '#1a6b4a',
    "dedication_text" TEXT,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "variant" TEXT NOT NULL DEFAULT 'softcover_20',
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "worksheet_ids" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "printful_file_url" TEXT,
    "preview_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "coloring_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "book_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" REAL NOT NULL,
    "total_price" REAL NOT NULL,
    "shipping_cost" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "first_name" TEXT NOT NULL DEFAULT '',
    "last_name" TEXT NOT NULL DEFAULT '',
    "address1" TEXT NOT NULL DEFAULT '',
    "address2" TEXT,
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT,
    "zip" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "printful_order_id" TEXT,
    "tracking_url" TEXT,
    "tracking_number" TEXT,
    "estimated_delivery" DATETIME,
    "stripe_session_id" TEXT,
    "price_paid" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "book_orders_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "coloring_books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "book_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "name_nl" TEXT,
    "description" TEXT NOT NULL,
    "cover_image_url" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'softcover_20',
    "price" REAL NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 20,
    "worksheet_ids" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
