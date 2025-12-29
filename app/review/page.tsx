"use client";

import { useEffect, useState } from "react";
import { LabelVerification } from "@/lib/schemas";
import Link from "next/link";
import { AdditiveDisclosurePanel } from "./components/AdditiveDisclosurePanel";
import { AIEvaluationPanel } from "./components/AIEvaluationPanel";
import { ExpectedDataPanel } from "./components/ExpectedDataPanel";
import { ExtractedDataPanel } from "./components/ExtractedDataPanel";
import { ImageSelector } from "./components/ImageSelector";
import { ResultsTable } from "./components/ResultsTable";
import { ReviewActions } from "./components/ReviewActions";
import { SummaryPanel } from "./components/SummaryPanel";

export default function ReviewPage() {
  const [verifications, setVerifications] = useState<LabelVerification[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const data = sessionStorage.getItem("verifications");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        setVerifications(parsed);
      } catch (error) {
        console.error("Error parsing verification data:", error);
      }
    }
  }, []);

  if (verifications.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-6">Review Results</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No verification results available. Please upload and process images first.
          </p>
          <Link
            href="/upload"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go to Upload
          </Link>
        </div>
      </div>
    );
  }

  const currentVerification = verifications[selectedIndex];
  const passCount = verifications.filter((v) => v.overallStatus === "✅").length;
  const warningCount = verifications.filter((v) => v.overallStatus === "⚠️").length;
  const failCount = verifications.filter((v) => v.overallStatus === "❌").length;
  const sanitizeAscii = (value: string) => value.replace(/[^\x20-\x7E]/g, "?");
  const escapePdfText = (value: string) =>
    sanitizeAscii(value)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  const wrapLine = (value: string, maxLength: number) => {
    const trimmed = value.trim();
    if (!trimmed) return [""];
    const lines: string[] = [];
    let remaining = trimmed;
    while (remaining.length > maxLength) {
      let splitAt = remaining.lastIndexOf(" ", maxLength);
      if (splitAt <= 0) splitAt = maxLength;
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    if (remaining.length) {
      lines.push(remaining);
    }
    return lines;
  };
  const handleExport = () => {
    const exportedAt = new Date().toISOString();
    const maxLineLength = 90;
    const lines: string[] = [];
    const addText = (text: string) => {
      wrapLine(text, maxLineLength).forEach((line) => lines.push(line));
    };

    addText("Label Verification Results");
    addText(`Exported: ${exportedAt}`);
    lines.push("");

    verifications.forEach((verification) => {
      const evaluationPassed = verification.evaluation
        ? verification.evaluation.passed
          ? "passed"
          : "failed"
        : "missing";
      addText(
        `Image: ${verification.imageName} (${verification.overallStatus})`
      );
      addText(`Evaluation: ${evaluationPassed}`);
      verification.results.forEach((result) => {
        addText(`- ${result.field}: ${result.status} ${result.message ?? ""}`);
        addText(`  Expected: ${result.expected}`);
        addText(`  Extracted: ${result.extracted}`);
      });
      lines.push("");
    });

    const pageHeight = 792;
    const margin = 40;
    const lineHeight = 12;
    const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
      pages.push(lines.slice(i, i + linesPerPage));
    }

    const buildContentStream = (pageLines: string[]) => {
      const startY = pageHeight - margin;
      let stream = `BT\n/F1 10 Tf\n${margin} ${startY} Td\n`;
      pageLines.forEach((line, index) => {
        const safeLine = escapePdfText(line);
        if (index > 0) {
          stream += `0 -${lineHeight} Td\n`;
        }
        stream += `(${safeLine}) Tj\n`;
      });
      stream += "ET\n";
      return stream;
    };

    const objects: string[] = [];
    const addObject = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesObjectIndex = addObject("");
    const fontObjectNumber = addObject(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    );

    const pageObjectNumbers: number[] = [];
    pages.forEach((pageLines) => {
      const content = buildContentStream(pageLines);
      const contentObjectNumber = addObject(
        `<< /Length ${content.length} >>\nstream\n${content}endstream`
      );
      const pageObjectNumber = addObject(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
      );
      pageObjectNumbers.push(pageObjectNumber);
    });

    objects[pagesObjectIndex - 1] = `<< /Type /Pages /Kids [${pageObjectNumbers
      .map((num) => `${num} 0 R`)
      .join(" ")}] /Count ${pageObjectNumbers.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    objects.forEach((object) => {
      offsets.push(pdf.length);
      pdf += `${offsets.length - 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const stamp = exportedAt.replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `label-verifications-${stamp}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-6 text-center">Review Results</h1>

      <SummaryPanel
        passCount={passCount}
        warningCount={warningCount}
        failCount={failCount}
      />

      <ImageSelector
        verifications={verifications}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />

      {/* Side-by-Side Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {currentVerification.imageName}
          </h2>
          <div className="text-2xl">{currentVerification.overallStatus}</div>
        </div>

        <AIEvaluationPanel evaluation={currentVerification.evaluation} />
        <AdditiveDisclosurePanel results={currentVerification.results} />
        <ResultsTable results={currentVerification.results} />
      </div>

      {/* Detailed View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <ExpectedDataPanel data={currentVerification.expectedData} />
        <ExtractedDataPanel data={currentVerification.extractedData} />
      </div>

      {/* Actions */}
      <ReviewActions onExport={handleExport} />
    </div>
  );
}
