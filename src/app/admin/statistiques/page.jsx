import styles from "./statistiques.module.css";
import AnalyticsClient from "./components/AnalyticsClient";

// L'accès est déjà contrôlé par src/app/admin/layout.jsx (admin connecté) et les données
// par /api/admin/analytics (requireAdmin).
export default function AdminStatistiques() {
  return (
    <div className={styles.container}>
      <div className={styles.topbar}>
        <h1 className={styles.title}>Statistiques</h1>
        <p className={styles.subtitle}>Audience du site — anonyme, sans cookie ni adresse IP stockée.</p>
      </div>
      <AnalyticsClient />
    </div>
  );
}
