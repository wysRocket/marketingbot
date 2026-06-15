// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = any;

export async function dismissHolaConsents(context: AnyContext): Promise<void> {
  context.on("page", (page: AnyContext) => {
    page
      .waitForLoadState("domcontentloaded", { timeout: 5_000 })
      .then(() => {
        const url = page.url();
        if (url.includes("hola.org") && url.includes("welcome")) {
          void page.close();
        }
      })
      .catch(() => {});
  });
}
