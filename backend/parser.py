import pandas as pd
import io

class RIFTDataParser:
    def parse_and_validate(self, csv_content: bytes):
        try:
            # Efficiently load 10k rows
            df = pd.read_csv(io.BytesIO(csv_content))
            
            # Mandatory RIFT Columns & Types
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
            df['timestamp'] = pd.to_datetime(df['timestamp'], format='%Y-%m-%d %H:%M:%S', errors='coerce')
            
            # Drop rows with critical missing data
            df = df.dropna(subset=['sender_id', 'receiver_id', 'transaction_id', 'timestamp'])
            
            if not df['transaction_id'].is_unique:
                return None, "Constraint Violation: transaction_id must be unique."
            
            return df, "Validation Passed"
        except Exception as e:
            return None, f"Parsing Error: {str(e)}"