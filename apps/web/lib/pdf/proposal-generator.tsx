import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Type definitions for the proposal data
interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface ProposalData {
  contractor: {
    companyName: string;
    email: string;
    phone: string | null;
  };
  lead: {
    homeownerName: string;
    homeownerEmail: string;
    homeownerPhone: string;
    address: string;
  };
  estimate: {
    id: string;
    lineItems: LineItem[];
    subtotal: number;
    margin: number;
    contingency: number;
    total: number;
    createdAt: Date;
  };
}

// Styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #2563eb',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  companyContact: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#1e293b',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#334155',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: '30%',
    color: '#475569',
  },
  value: {
    width: '70%',
    color: '#1e293b',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 10,
    borderBottom: '2px solid #cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #e2e8f0',
    fontSize: 10,
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 10,
  },
  col1: {
    width: '40%',
  },
  col2: {
    width: '15%',
    textAlign: 'right',
  },
  col3: {
    width: '15%',
    textAlign: 'right',
  },
  col4: {
    width: '15%',
    textAlign: 'right',
  },
  col5: {
    width: '15%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  totalsSection: {
    marginTop: 20,
    marginLeft: '55%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 11,
    color: '#475569',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    minWidth: 80,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '2px solid #2563eb',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    minWidth: 80,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 9,
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
  depositNotice: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#dbeafe',
    borderLeft: '4px solid #2563eb',
    borderRadius: 4,
  },
  depositText: {
    fontSize: 10,
    color: '#1e40af',
  },
});

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value / 100);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const ProposalDocument: React.FC<{ data: ProposalData; depositPercentage: number }> = ({
  data,
  depositPercentage,
}) => {
  const depositAmount = (data.estimate.total * depositPercentage) / 100;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.contractor.companyName}</Text>
          <Text style={styles.companyContact}>{data.contractor.email}</Text>
          {data.contractor.phone && (
            <Text style={styles.companyContact}>{data.contractor.phone}</Text>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>Project Proposal</Text>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{data.lead.homeownerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{data.lead.homeownerEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{data.lead.homeownerPhone}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Property:</Text>
            <Text style={styles.value}>{data.lead.address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatDate(data.estimate.createdAt)}</Text>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Description</Text>
              <Text style={styles.col2}>Qty</Text>
              <Text style={styles.col3}>Unit</Text>
              <Text style={styles.col4}>Unit Price</Text>
              <Text style={styles.col5}>Total</Text>
            </View>
            {data.estimate.lineItems.map((item, index) => (
              <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.col1}>{item.description}</Text>
                <Text style={styles.col2}>{item.quantity}</Text>
                <Text style={styles.col3}>{item.unit}</Text>
                <Text style={styles.col4}>{formatCurrency(item.unitPrice)}</Text>
                <Text style={styles.col5}>{formatCurrency(item.total)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.estimate.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Margin ({data.estimate.margin}%):</Text>
            <Text style={styles.totalValue}>
              {formatCurrency((data.estimate.subtotal * data.estimate.margin) / 100)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Contingency ({data.estimate.contingency}%):</Text>
            <Text style={styles.totalValue}>
              {formatCurrency((data.estimate.subtotal * data.estimate.contingency) / 100)}
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Project Cost:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(data.estimate.total)}</Text>
          </View>
        </View>

        {/* Deposit Notice */}
        {depositPercentage > 0 && (
          <View style={styles.depositNotice}>
            <Text style={styles.depositText}>
              A {depositPercentage}% deposit of {formatCurrency(depositAmount)} is required to begin
              work. The remaining balance will be due upon project completion.
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This proposal is valid for 30 days from the date above. Terms and conditions apply.
          </Text>
          <Text>Estimate ID: {data.estimate.id}</Text>
        </View>
      </Page>
    </Document>
  );
};
