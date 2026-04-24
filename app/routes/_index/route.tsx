import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>RetailIQ — Retail Media for Shopify</h1>
        <p className={styles.text}>
          Turn your store into an ad platform. Let your suppliers sponsor banner placements and grow revenue without discounting.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Sponsored banners</strong>. Let suppliers auto-generate and serve branded banners directly on your storefront.
          </li>
          <li>
            <strong>Google Ad Manager integration</strong>. Banners are served through GAM for reliable delivery and full reporting.
          </li>
          <li>
            <strong>Revenue without discounting</strong>. Monetise your store traffic by charging suppliers for premium placements.
          </li>
        </ul>
      </div>
    </div>
  );
}
