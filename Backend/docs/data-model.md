# Data relationships

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER ||--o{ PAYMENT : makes
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER ||--o{ PAYMENT : paid_by
    PRODUCT ||--o{ ORDER_ITEM : snapshot_source
    PAYMENT ||--o{ PAYMENT_EVENT : provider_events

    USER {
        ObjectId _id
        string firstName
        string lastName
        string email
        string password_hash
        string role
        boolean isActive
        number tokenVersion
    }
    PRODUCT {
        ObjectId _id
        string name
        string slug
        number price
        string category
        number stockQuantity
        boolean isActive
    }
    ORDER {
        ObjectId _id
        string orderNumber
        ObjectId customer
        number totalAmount
        string currency
        string status
        string paymentStatus
    }
    ORDER_ITEM {
        ObjectId product
        string productName
        number quantity
        number unitPrice
        number subtotal
    }
    PAYMENT {
        ObjectId _id
        ObjectId order
        ObjectId customer
        string providerReference
        number amount
        string status
    }
    PAYMENT_EVENT {
        string providerEventId
        string type
        datetime processedAt
    }
```

Order items keep a product name and price snapshot. A subsequent product edit
does not change a previously placed order. Product references are retained for
traceability and inventory reservation/release.
