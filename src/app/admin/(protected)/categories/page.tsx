import AdminCategoriesManager from "@/components/AdminCategoriesManager";
import { adminListCategories } from "@/lib/adminCatalogue.server";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await adminListCategories();

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-semibold text-primary">
        Categories
      </h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        Template categories for the browser&apos;s filter rail. A template&apos;s
        first category sets the accent colour of its starter layout.
      </p>
      <AdminCategoriesManager categories={categories} />
    </>
  );
}
