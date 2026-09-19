# Productify Authentication Testing

Admin: `admin@productify.now` / `ProductifyAdmin123!`

1. Register a buyer or seller at `/api/auth/register`.
2. Login at `/api/auth/login` and store the returned bearer token.
3. Call `/api/auth/me` with `Authorization: Bearer <token>`.
4. Google demo flow is available at `/api/auth/google`.
5. Seller users may create products and pending rental submissions.
6. Admin users may review `/api/admin/pending` and decide a rental.