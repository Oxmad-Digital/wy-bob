import { getRequest, CHRONOPOST_URLS, ChronopostError } from "./client";

export interface CancelResult {
  cancelled: boolean;
  statusCode?: number;
  message: string;
}

const STATUS_MESSAGES: Record<number, string> = {
  0: "Annulation effectuée",
  1: "Erreur système Chronopost",
  2: "Le colis ne correspond pas au contrat",
  3: "Colis non encore intégré ou déjà pris en charge par Chronopost",
};

/**
 * cancelListSkybill — annulation d'une étiquette, ~10 min après sa création.
 * Non testable avec le compte test Chronopost fourni (cf. cahier des charges) : à
 * vérifier une fois le compte de production activé.
 */
export async function cancelShipment(skybillNumber: string, language = "fr_FR"): Promise<CancelResult> {
  const parsed = await getRequest(CHRONOPOST_URLS.tracking, "cancelListSkybill", {
    skybillNumber,
    language,
  });

  const body = parsed?.Envelope?.Body;
  const responseNode = body?.cancelListSkybillResponse;
  const result = responseNode?.return ?? responseNode;

  if (result?.errorCode !== undefined && Number(result.errorCode) !== 0) {
    throw new ChronopostError(
      result.errorMessage || `Erreur annulation Chronopost (code ${result.errorCode})`,
      result.errorCode
    );
  }

  const statusCode = result?.statusCode !== undefined ? Number(result.statusCode) : undefined;

  return {
    cancelled: statusCode === 0,
    statusCode,
    message:
      statusCode !== undefined
        ? STATUS_MESSAGES[statusCode] || `Code retour Chronopost ${statusCode}`
        : "Réponse Chronopost inattendue",
  };
}
