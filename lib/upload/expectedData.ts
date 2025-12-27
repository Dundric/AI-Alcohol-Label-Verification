import {
  AdditiveDisclosure,
  expectedAlcoholLabelSchema,
  ExpectedAlcoholLabel,
  GovernmentWarningField,
  SimpleField,
} from "@/lib/schemas";
import { STANDARD_GOV_WARNING_LONG } from "@/lib/upload/constants";

export const defaultAdditives: AdditiveDisclosure = {
  fdcYellowNo5: false,
  cochinealExtract: false,
  carmine: false,
  aspartame: false,
  sulfitesGe10ppm: false,
};

export function buildSimpleField(text: string): SimpleField {
  return { text };
}

export function buildGovernmentWarningField(
  text: string,
  options: Partial<Pick<GovernmentWarningField, "isBold" | "isAllCaps">> = {}
): GovernmentWarningField {
  return {
    text,
    isBold: options.isBold ?? true,
    isAllCaps: options.isAllCaps ?? true,
  };
}

export function getDefaultExpectedData(): ExpectedAlcoholLabel {
  return {
    productType: null,
    brandName: buildSimpleField("FIREBALL"),
    classType: buildSimpleField("CINNAMON WHISKY"),
    alcoholContent: buildSimpleField("ALC. 33% BY VOL."),
    netContents: buildSimpleField("100ML"),
    governmentWarning: buildGovernmentWarningField(STANDARD_GOV_WARNING_LONG),
    bottlerProducer: buildSimpleField("PRODUCED AND BOTTLED BY SAZERAC CO., FRANKFORT, KY"),
    countryOfOrigin: null,
    ageYears: null,
    isImported: false,
    beerHasAddedFlavorsWithAlcohol: false,
    additivesDetected: defaultAdditives,
  };
}

export function normalizeExpectedData(
  expectedData: ExpectedAlcoholLabel
): ExpectedAlcoholLabel {
  return {
    ...expectedData,
    governmentWarning: buildGovernmentWarningField(STANDARD_GOV_WARNING_LONG),
  };
}

export function getExpectedDataValidationError(
  expectedData: ExpectedAlcoholLabel
): string | null {
  const parsed = expectedAlcoholLabelSchema.safeParse(expectedData);
  if (parsed.success) {
    return null;
  }

  return parsed.error.issues.map((issue) => issue.message).join("\n- ");
}
