declare module 'react-native-sqlite-storage' {
  export type SQLiteValue = string | number | null;

  export interface ResultSetRowList {
    length: number;
    item(index: number): any;
    raw?(): any[];
  }

  export interface ResultSet {
    insertId?: number;
    rowsAffected: number;
    rows: ResultSetRowList;
  }

  export interface Transaction {
    executeSql(
      sqlStatement: string,
      args?: SQLiteValue[],
      callback?: (tx: Transaction, resultSet: ResultSet) => void,
      errorCallback?: (tx: Transaction, error: Error) => void,
    ): void;
  }

  export interface SQLiteDatabase {
    executeSql(sqlStatement: string, params?: SQLiteValue[]): Promise<[ResultSet]>;
    transaction(
      fn: (tx: Transaction) => void,
      error?: (error: Error) => void,
      success?: () => void,
    ): void;
    close(): Promise<void>;
  }

  export interface SQLiteOpenOptions {
    name: string;
    location?: 'default' | 'Library' | 'Documents' | 'Shared';
    createFromLocation?: number | string;
  }

  export interface SQLiteStatic {
    enablePromise(value: boolean): void;
    openDatabase(
      options: SQLiteOpenOptions | string,
      version?: string,
      displayName?: string,
      size?: number,
    ): Promise<SQLiteDatabase>;
  }

  const SQLite: SQLiteStatic;
  export default SQLite;
}
