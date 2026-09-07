import { relations } from "drizzle-orm";
import { products, templateCategories, templateCategoryLinks, templates } from "./catalogue";
import { designAssets, designs, designVersions } from "./designs";
import { orderEvents, orderItems, orderProofPages, orderProofs, orders } from "./orders";
import { colourOptions, deliveryOptions, pageCountOptions, paperOptions, quantityOptions, sizeOptions } from "./pricing";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  designs: many(designs),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ many }) => ({
  templates: many(templates),
  sizeOptions: many(sizeOptions),
  colourOptions: many(colourOptions),
  paperOptions: many(paperOptions),
  quantityOptions: many(quantityOptions),
  pageCountOptions: many(pageCountOptions),
  deliveryOptions: many(deliveryOptions),
}));

export const templateCategoriesRelations = relations(templateCategories, ({ many }) => ({
  templateLinks: many(templateCategoryLinks),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  product: one(products, { fields: [templates.productId], references: [products.id] }),
  categoryLinks: many(templateCategoryLinks),
  designs: many(designs),
}));

export const templateCategoryLinksRelations = relations(templateCategoryLinks, ({ one }) => ({
  template: one(templates, {
    fields: [templateCategoryLinks.templateId],
    references: [templates.id],
  }),
  category: one(templateCategories, {
    fields: [templateCategoryLinks.categoryId],
    references: [templateCategories.id],
  }),
}));

export const designsRelations = relations(designs, ({ one, many }) => ({
  user: one(users, { fields: [designs.userId], references: [users.id] }),
  template: one(templates, { fields: [designs.templateId], references: [templates.id] }),
  product: one(products, { fields: [designs.productId], references: [products.id] }),
  assets: many(designAssets),
  versions: many(designVersions),
  orderItems: many(orderItems),
}));

export const designAssetsRelations = relations(designAssets, ({ one }) => ({
  user: one(users, { fields: [designAssets.userId], references: [users.id] }),
  design: one(designs, { fields: [designAssets.designId], references: [designs.id] }),
}));

export const designVersionsRelations = relations(designVersions, ({ one }) => ({
  design: one(designs, { fields: [designVersions.designId], references: [designs.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  events: many(orderEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  design: one(designs, { fields: [orderItems.designId], references: [designs.id] }),
  proofs: many(orderProofs),
}));

export const orderProofsRelations = relations(orderProofs, ({ one, many }) => ({
  orderItem: one(orderItems, { fields: [orderProofs.orderItemId], references: [orderItems.id] }),
  pages: many(orderProofPages),
}));

export const orderProofPagesRelations = relations(orderProofPages, ({ one }) => ({
  proof: one(orderProofs, { fields: [orderProofPages.proofId], references: [orderProofs.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));
