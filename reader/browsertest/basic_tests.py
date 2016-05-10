from framework import AtomicTest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.expected_conditions import title_contains, staleness_of, element_to_be_clickable, visibility_of_element_located
from selenium.webdriver.common.keys import Keys

TEMPER = 5

class RecentInToc(AtomicTest):
    suite_key = "S2 Reader"
    mobile = False

    def run(self):
        self.driver.get(self.base_url + "/texts")

        self.driver.find_element_by_class_name('readerNavCategory[data-cat="Tanach"]').click()  # The "Tanach" category is first
        WebDriverWait(self.driver, TEMPER).until(title_contains("Tanach"))

        p1 = self.driver.find_element_by_css_selector('.refLink[data-ref="Psalms 1"]')
        p1.click()
        WebDriverWait(self.driver, TEMPER).until(title_contains("Psalms"))

        self.driver.get(self.base_url + "/texts")
        WebDriverWait(self.driver, TEMPER).until(title_contains("Texts"))

        recent = self.driver.find_element_by_css_selector('.recentItem[data-ref="Psalms 1"]')
        recent.click()
        WebDriverWait(self.driver, TEMPER).until(title_contains("Psalms"))


class LoadRefAndClickSegment(AtomicTest):
    suite_key = "S2 Reader"

    def run(self):
        self.driver.get(self.base_url + "/Psalms.65.5")
        WebDriverWait(self.driver, TEMPER).until(title_contains("Psalms 65:5"))

        segment = self.driver.find_element_by_css_selector('.segment[data-ref="Psalms 65:5"]')
        segment.click()
        WebDriverWait(self.driver, TEMPER).until(title_contains("Psalms 65:5 with Connections"))
        assert "Psalms.65.5?with=all" in self.driver.current_url
        rashi = self.driver.find_element_by_css_selector('.textFilter[data-name="Malbim"]')
        assert rashi


class LoadRefWithCommentaryAndClickOnCommentator(AtomicTest):
    suite_key = "S2 Reader"

    def run(self):
        self.driver.get(self.base_url + "/Psalms.45.5?with=all")
        assert "Psalms 45:5 with Connections" in self.driver.title, self.driver.title
        rashi = self.driver.find_element_by_css_selector('.textFilter[data-name="Rashi"]')
        rashi.click()
        WebDriverWait(self.driver, TEMPER).until(staleness_of(rashi))
        assert "Psalms.45.5?with=Rashi" in self.driver.current_url, self.driver.current_url


class ClickVersionedSearchResultDesktop(AtomicTest):
    suite_key = "S2 Search"
    mobile = False

    def run(self):
        self.driver.get(self.base_url + "/s2")
        elem = self.driver.find_element_by_css_selector("input.search")
        elem.send_keys("Dogs")
        elem.send_keys(Keys.RETURN)
        WebDriverWait(self.driver, TEMPER).until(title_contains("Dogs"))
        versionedResult = self.driver.find_element_by_css_selector('a[href="/Psalms.59.7/en/The_Rashi_Ketuvim_by_Rabbi_Shraga_Silverstein?qh=Dogs"]')
        versionedResult.click()
        WebDriverWait(self.driver, TEMPER).until(staleness_of(versionedResult))
        assert "Psalms.59.7/en/The_Rashi_Ketuvim_by_Rabbi_Shraga_Silverstein" in self.driver.current_url


class ClickVersionedSearchResultMobile(AtomicTest):
    suite_key = "S2 Search"
    desktop = False

    def run(self):
        self.driver.get(self.base_url + "/s2")
        hamburger = self.driver.find_element_by_css_selector(".readerNavMenuMenuButton")
        if hamburger:
            hamburger.click()
            wait = WebDriverWait(self.driver, TEMPER)
            wait.until(staleness_of(hamburger))
        elem = self.driver.find_element_by_css_selector("input.search")
        elem.send_keys("Dogs")
        elem.send_keys(Keys.RETURN)
        WebDriverWait(self.driver, TEMPER).until(title_contains("Dogs"))
        versionedResult = self.driver.find_element_by_css_selector('a[href="/Psalms.59.7/en/The_Rashi_Ketuvim_by_Rabbi_Shraga_Silverstein?qh=Dogs"]')
        versionedResult.click()
        WebDriverWait(self.driver, TEMPER).until(staleness_of(versionedResult))
        assert "Psalms.59.7/en/The_Rashi_Ketuvim_by_Rabbi_Shraga_Silverstein" in self.driver.current_url