---
name: bull-bear-scenarios
description: Detect market regimes (bull/bear), compute expected regime durations, and generate Monte Carlo price scenarios conditioned on detected regimes. Trigger when user asks for: 'regime detection', 'bull/bear scenariusze', 'HMM + Monte Carlo', 'scenariusze cen akcji'.
---
# Bull-Bear Scenario Generator — instrukcja dla agenta

Rola: Dostarcz modelu/agentowi Claude z proceduralnym przepływem pracy do wykrywania reżimów rynkowych (bull / bear) przy użyciu HMM, obliczania oczekiwanego czasu trwania reżimu oraz generowania scenariuszy cen akcji metodą Monte Carlo (GBM) warunkowanych na stanie.

## Kiedy użyć tego skilla
- Gdy użytkownik prosi o: „wykryj reżim bull/bear”, „wygeneruj scenariusze cen dla bull/bear”, „HMM + Monte Carlo”, „scenariusze akcji dla ticker X”.

## Kroki (zwięzły workflow)
1. Pobierz dane historyczne (ceny zamknięcia) w żądanej częstotliwości (domyślnie dzienne). Utwórz log‑zwroty r_t = ln(P_t/P_{t-1}).
2. Dopasuj HMM na serii zwrotów (np. Gaussian HMM z 2–3 stanami). Użyj BIC/AIC by wybrać liczbę stanów jeśli potrzebne.【call_bN6ptXRhIjKafRVUYoVHxaNe-0】【call_bN6ptXRhIjKafRVUYoVHxaNe-9】
3. Wyciągnij macierz przejść P. Dla stanu i diagonalny element p_ii to prawdopodobieństwo pozostania w stanie w kolejnym kroku; oczekiwany czas trwania stanu (w jednostkach kroków czasowych, np. sesji dziennych) przybliżony jest wzorem 1/(1 − p_ii)【call_c4ONAO7ZE1EvWOIL8ifdoGbF-1】.
4. Wybierz horyzonty scenariuszy w odniesieniu do expected duration:
   - Krótki ≈ 0.25 × expected_duration
   - Średni ≈ 1 × expected_duration
   - Długi ≈ 2–4 × expected_duration
   Równolegle generuj standardowe horyzonty porównawcze (1 dzień / 1 tydzień / 1 miesiąc / kwartal / rok) dla pełnej analizy【call_bN6ptXRhIjKafRVUYoVHxaNe-6】【call_Dg5SR2aNHaiuSbyHA8c5OdBg-0】.
5. Estymuj parametry drift (μ) i volatilność (σ) oddzielnie dla każdego stanu (średnie zwrotu i std zwrotu w danym stanie). Jeśli chcesz modelować zmienność warunkową, rozważ GARCH / MS‑GARCH dla σ (opcjonalne, wymaga bardziej zaawansowanej estymacji)【call_bN6ptXRhIjKafRVUYoVHxaNe-4】【call_bN6ptXRhIjKafRVUYoVHxaNe-3】.
6. Generuj N ścieżek Monte Carlo:
   - Prosty wariant: GBM z parametrami (μ_i, σ_i) zależnymi od aktualnego stanu i dyskretnym krokiem Δt.
   - Alternatywa: bootstrapowanie historycznych residuów lub symulacja z przejściami reżimów (symuluj najpierw łańcuch Markova, potem dla każdego kroku użyj parametrów stanu)【call_Dg5SR2aNHaiuSbyHA8c5OdBg-0】【call_Dg5SR2aNHaiuSbyHA8c5OdBg-3】.
7. Agreguj wyniki: percentyle (5%, 25%, 50%, 75%, 95%), prawdopodobieństwo przekroczenia progów, diagnostyka rozkładu końcowego.
8. Walidacja: testy out‑of‑sample i backtest. Zaprezentuj niepewność i limitacje modelu (literatura wskazuje, że reżimowe modele dobrze opisują historię, ale prognostyczna siła bywa ograniczona)【call_bN6ptXRhIjKafRVUYoVHxaNe-5】.

## Metryki i kontrole jakości
- Dla reżimów: statystyki zwrotów per stan (mean, std, skew), confusion matrix jeśli są etykiety historyczne.
- Dla scenariuszy: MSE/MAE dla punktowych prognoz; kalibracja dystrybucji (coverage) dla przedziałów probabilistycznych.
- Backtest: porównanie wyników strategii switchingowej vs baseline.

## Zasady praktyczne i ostrzeżenia
- Używaj danych o wystarczającej długości (kilka lat dla danych dziennych) by model zobaczył przełączenia reżimów; krótkie serie zwiększają ryzyko overfittingu【call_bN6ptXRhIjKafRVUYoVHxaNe-6】.
- Jeśli p_ii jest bardzo wysoki → długie reżimy: interpretuje się to jako rzadkie przejścia; dostosuj horyzonty i próbkowanie.
- Zadbaj o walidację OOS — wiele badań wskazuje na ograniczoną prognostyczną użyteczność reżimowych modeli bez solidnej walidacji【call_bN6ptXRhIjKafRVUYoVHxaNe-5】.

## Przykładowy pseudokod (Python, szkic)

```python
# pip: hmmlearn, numpy, pandas
import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

def fit_hmm(returns, n_states=2):
    model = GaussianHMM(n_components=n_states, covariance_type='diag', n_iter=200)
    model.fit(returns.reshape(-1,1))
    states = model.predict(returns.reshape(-1,1))
    P = model.transmat_
    return model, states, P

# expected duration for state i:
# expected_duration = 1 / (1 - P[i,i])

# Monte Carlo GBM conditioned on state params
# S_{t+1} = S_t * exp( (mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*z )
```

(Dołącz pełny, uruchamialny kod jako zasób jeśli użytkownik poprosi — lepiej wręczyć jako bundle `scripts/`.)

## Przyklady wyzwalaczy (do opisu skillu)
- "Wykryj reżim bull lub bear dla ticker X"
- "Wygeneruj scenariusze cenowe (bull/bear) na 30 dni" 
- "Dopasuj HMM do zwrotów i zrób Monte Carlo warunkowane na stanie"

## Pliki referencyjne (zalecane gdy skill będzie pakowany jako bundle)
- scripts/fit_hmm.py — dopasowanie HMM + wyliczenie P
- scripts/generate_mc.py — generator Monte Carlo warunkowy na stanie
- references/background.md — krótkie odwołania do literatury i linków

## Źródła i dalsza lektura
- HMM do wykrywania reżimów rynkowych — praktyczne tutoriale i przykłady implementacji【call_bN6ptXRhIjKafRVUYoVHxaNe-0】【call_bN6ptXRhIjKafRVUYoVHxaNe-6】
- Oczekiwany czas trwania stanu w łańcuchu Markowa — wzór i dowody (1/(1−p_ii))【call_c4ONAO7ZE1EvWOIL8ifdoGbF-1】
- Monte Carlo + GBM — generowanie ścieżek cen akcji i instrukcje praktyczne【call_Dg5SR2aNHaiuSbyHA8c5OdBg-0】【call_Dg5SR2aNHaiuSbyHA8c5OdBg-3】

---

Postępuj: jeśli chcesz, mogę natychmiast stworzyć ten skill w Twojej bibliotece (teksty + podstawowy SKILL.md) albo przygotować paczkę `.zip` z przykładowymi skryptami (wymaga uploadu bundle). Co wolisz?