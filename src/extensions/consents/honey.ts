// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = any;

export async function dismissHoneyConsents(context: AnyContext): Promise<void> {
  context.on("page", (page: AnyContext) => {
    page
      .waitForLoadState("domcontentloaded", { timeout: 5_000 })
      .then(() => {
        const url = page.url();
        if (url.includes("joinhoney.com") && (url.includes("welcome") || url.includes("signup"))) {
          void page.close();
        }
      })
      .catch(() => {});
  });
}
