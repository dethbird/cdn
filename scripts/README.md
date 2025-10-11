
This folder contains a utility PHP script for the project.

reset_db_and_clean.php - PHP CLI script to reset the SQLite DB using `db/reset.sql` and remove contents under `public/m/`.

Usage:

    php scripts/reset_db_and_clean.php [--dry-run] [--yes]

Notes:
- The script creates a timestamped backup of `db/cdn.sqlite` before applying the SQL file.
- The SQL file may include its own transaction statements; the script will execute it as-is (no additional BEGIN/COMMIT).
- Use `--dry-run` to preview actions and `--yes` to skip interactive confirmations.

