# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/37b7641e-64e4-4b20-a858-60b3aca87347

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/37b7641e-64e4-4b20-a858-60b3aca87347) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/37b7641e-64e4-4b20-a858-60b3aca87347) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## RLS Tests — Required Environment Variables

The `highlights` RLS test suite (`src/lib/highlightsRls.test.ts`) and its seed script need the variables below. Put them in `.env.local` (gitignored) or export them in your shell, then run `npm run preflight:rls` to validate.

| Variable | Format / Example |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable JWT (`eyJhbGciOi...`) |
| `TEST_USER_A_EMAIL` | valid email, e.g. `rls-a@example.com` |
| `TEST_USER_A_PASSWORD` | ≥ 8 chars, e.g. `Aa1!aaaa` |
| `TEST_USER_B_EMAIL` | valid email, **different** from A, e.g. `rls-b@example.com` |
| `TEST_USER_B_PASSWORD` | ≥ 8 chars |
| `TEST_BOOK_ID` | UUID owned by user A — populated automatically by `npm run seed:rls` |

### Example `.env.local`

```bash
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
TEST_USER_A_EMAIL=rls-a@example.com
TEST_USER_A_PASSWORD=Aa1!aaaa
TEST_USER_B_EMAIL=rls-b@example.com
TEST_USER_B_PASSWORD=Bb2!bbbb
```

### Scripts

- `npm run preflight:rls` — validate env vars, formats and Node version.
- `npm run seed:rls` — preflight + provision test users and seed book (idempotent).
- `npm run test:rls` — preflight + run the RLS Vitest suite.

In CI, configure the same names as GitHub Actions secrets; the workflow `.github/workflows/rls-tests.yml` runs the equivalent checks before seed and tests.
