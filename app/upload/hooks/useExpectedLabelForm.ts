import { useState } from "react";
import { AdditiveDisclosure, ExpectedAlcoholLabel } from "@/lib/schemas";
import {
  buildSimpleField,
  getDefaultExpectedData,
} from "@/lib/upload/expectedData";

type RequiredFieldKey =
  | "brandName"
  | "classType"
  | "netContents"
  | "bottlerProducer";

type OptionalFieldKey = "countryOfOrigin";

type FlagFieldKey = "isImported" | "beerHasAddedFlavorsWithAlcohol";

export type ExpectedDataHandlers = {
  updateRequiredField: (field: RequiredFieldKey, value: string) => void;
  updateAlcoholContent: (value: string) => void;
  updateOptionalField: (field: OptionalFieldKey, value: string) => void;
  updateFlag: (field: FlagFieldKey, value: boolean) => void;
  updateAgeYears: (value: string) => void;
  updateAdditive: (key: keyof AdditiveDisclosure, value: boolean) => void;
};

export function useExpectedLabelForm(
  initialData?: ExpectedAlcoholLabel
): {
  expectedData: ExpectedAlcoholLabel;
  handlers: ExpectedDataHandlers;
} {
  const [expectedData, setExpectedData] = useState<ExpectedAlcoholLabel>(
    initialData ?? getDefaultExpectedData()
  );

  const handlers: ExpectedDataHandlers = {
    updateRequiredField: (field, value) => {
      setExpectedData((prev) => ({
        ...prev,
        [field]: { ...prev[field], text: value },
      }));
    },
    updateAlcoholContent: (value) => {
      const trimmed = value.trim();
      setExpectedData((prev) => ({
        ...prev,
        alcoholContent: trimmed.length === 0 ? null : buildSimpleField(value),
      }));
    },
    updateOptionalField: (field, value) => {
      const trimmed = value.trim();
      setExpectedData((prev) => ({
        ...prev,
        [field]: trimmed.length === 0 ? null : buildSimpleField(value),
      }));
    },
    updateFlag: (field, value) => {
      setExpectedData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    updateAgeYears: (value) => {
      const parsed = Number.parseFloat(value);
      setExpectedData((prev) => ({
        ...prev,
        ageYears: Number.isNaN(parsed) ? null : parsed,
      }));
    },
    updateAdditive: (key, value) => {
      setExpectedData((prev) => ({
        ...prev,
        additivesDetected: { ...prev.additivesDetected, [key]: value },
      }));
    },
  };

  return { expectedData, handlers };
}
