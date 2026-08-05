import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1c1917" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  sellerName: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  smallLine: { fontSize: 9, color: "#57534e", lineHeight: 1.5 },
  title: { fontSize: 20, fontWeight: 700, textAlign: "right", marginBottom: 6 },
  metaLine: { fontSize: 9, textAlign: "right", color: "#57534e" },
  blockRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  blockTitle: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#78716c", marginBottom: 6 },
  table: { borderTop: "1pt solid #e7e5e4", borderBottom: "1pt solid #e7e5e4", marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f4", paddingVertical: 6, paddingHorizontal: 6, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderTop: "0.5pt solid #f0efed" },
  colName: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  totalsBlock: { alignSelf: "flex-end", width: 220, marginTop: 4 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTop: "1pt solid #1c1917", fontWeight: 700, fontSize: 11 },
  footer: { position: "absolute", bottom: 32, left: 40, right: 40, fontSize: 8, color: "#78716c", textAlign: "center", lineHeight: 1.5 },
});

function formatEur(n) {
  return `${Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function InvoiceDocument({ invoice }) {
  const { seller, customer, lineItems, orderNumber } = invoice;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sellerName}>{seller.companyName || "—"}</Text>
            {seller.legalForm ? <Text style={styles.smallLine}>{seller.legalForm}</Text> : null}
            <Text style={styles.smallLine}>{seller.address}</Text>
            <Text style={styles.smallLine}>{seller.postalCode} {seller.city}</Text>
            {seller.siret ? <Text style={styles.smallLine}>SIRET : {seller.siret}</Text> : null}
            <Text style={styles.smallLine}>
              {invoice.vatApplicable
                ? `TVA intracommunautaire : ${seller.vatNumber || "—"}`
                : "TVA non applicable, art. 293 B du CGI"}
            </Text>
          </View>
          <View>
            <Text style={styles.title}>FACTURE</Text>
            <Text style={styles.metaLine}>N° {invoice.invoiceNumber}</Text>
            <Text style={styles.metaLine}>Date d&apos;émission : {formatDate(invoice.issuedAt)}</Text>
            <Text style={styles.metaLine}>Commande n° {String(orderNumber ?? "").padStart(4, "0")}</Text>
          </View>
        </View>

        <View style={styles.blockRow}>
          <View />
          <View>
            <Text style={styles.blockTitle}>Facturé à</Text>
            <Text>{customer.firstname} {customer.lastname}</Text>
            {customer.company ? <Text style={styles.smallLine}>{customer.company}</Text> : null}
            <Text style={styles.smallLine}>{customer.address}</Text>
            <Text style={styles.smallLine}>{customer.postalCode} {customer.city}</Text>
            <Text style={styles.smallLine}>{customer.country}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Désignation</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>Prix unitaire TTC</Text>
            <Text style={styles.colTotal}>Total TTC</Text>
          </View>
          {lineItems.map((line, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colName}>{line.name}</Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colUnit}>{formatEur(line.unitPriceTtc)}</Text>
              <Text style={styles.colTotal}>{formatEur(line.totalTtc)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Sous-total produits</Text>
            <Text>{formatEur(invoice.subtotalTtc)}</Text>
          </View>
          {invoice.promoDiscount > 0 && (
            <View style={styles.totalsRow}>
              <Text>Remise</Text>
              <Text>-{formatEur(invoice.promoDiscount)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text>Livraison</Text>
            <Text>{formatEur(invoice.shippingFeeTtc)}</Text>
          </View>
          {invoice.vatApplicable ? (
            <>
              <View style={styles.totalsRow}>
                <Text>Total HT</Text>
                <Text>{formatEur(invoice.totalHt)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text>TVA ({invoice.vatRate}%)</Text>
                <Text>{formatEur(invoice.vatAmount)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.totalsRowFinal}>
            <Text>Total TTC</Text>
            <Text>{formatEur(invoice.totalTtc)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {seller.companyName}
            {seller.siret ? ` — SIRET ${seller.siret}` : ""}
            {seller.iban ? ` — IBAN ${seller.iban}` : ""}
          </Text>
          <Text>Facture émise électroniquement — dispensée de signature.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdfBuffer(invoice) {
  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} />);
  return buffer;
}
