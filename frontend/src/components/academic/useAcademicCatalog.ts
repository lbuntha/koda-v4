import { useEffect, useState } from "react";
import { academicApi, GradeCatalogItem, SubjectCatalogItem } from "../../api/academic";

export interface AcademicCatalogState {
  grades: GradeCatalogItem[];
  subjects: SubjectCatalogItem[];
  loading: boolean;
  error: Error | null;
}

let cachedCatalog: { grades: GradeCatalogItem[]; subjects: SubjectCatalogItem[] } | null = null;

export function useAcademicCatalog() {
  const [state, setState] = useState<AcademicCatalogState>({
    grades: cachedCatalog?.grades ?? [],
    subjects: cachedCatalog?.subjects ?? [],
    loading: !cachedCatalog,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    academicApi
      .list()
      .then((res) => {
        if (!isMounted) return;
        const activeGrades = (res.grades || []).filter((g) => g.active);
        const activeSubjects = (res.subjects || []).filter((s) => s.active);
        cachedCatalog = { grades: activeGrades, subjects: activeSubjects };
        setState({
          grades: activeGrades,
          subjects: activeSubjects,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
