var React        = require('react'),
    PropTypes    = require('prop-types'),
    ReactDOM     = require('react-dom'),
    extend       = require('extend'),
    classNames   = require('classnames'),
    Sefaria      = require('./sefaria');
    import Component from 'react-class';  //auto-bind this to all event-listeners. see https://www.npmjs.com/package/react-class


if (typeof document !== 'undefined' ) {
  var INBROWSER = true,
      $           = require("jquery");
      require('jquery.cookie');  //NOTE: these require statements are adding props to the $ obj. The order actually doesn't matter b/c it seems webpack deals with it
      require('jquery-ui');
      require('jquery.scrollto');
      require('./lib/headroom');
} else {
  var INBROWSER = false,
      $         = require("cheerio");
}




class Header extends Component {
  constructor(props) {
    super(props);

    this.state = props.initialState;
    this._searchOverridePre = 'Search for: "';
    this._searchOverridePost = '"';
  }
  componentDidMount() {
    this.initAutocomplete();
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.initialState) {
      this.setState(nextProps.initialState);
    }
  }
  _searchOverrideRegex() {
    return RegExp(`^${RegExp.escape(this._searchOverridePre)}(.*)${RegExp.escape(this._searchOverridePost)}`);
  }
  initAutocomplete() {
    $.widget( "custom.sefaria_autocomplete", $.ui.autocomplete, {
      _renderItem: function( ul, item) {
        var override = item.label.match(this._searchOverrideRegex());
		return $( "<li></li>" )
			.data( "item.autocomplete", item )
            .toggleClass("search-override", !!override)
			.append( $( "<a></a>" ).text( item.label ) )
			.appendTo( ul );
	  }.bind(this)
    });
    $(ReactDOM.findDOMNode(this)).find("input.search").sefaria_autocomplete({
      position: {my: "left-12 top+14", at: "left bottom"},
      minLength: 3,
      select: function( event, ui ) {
        $(ReactDOM.findDOMNode(this)).find("input.search").val(ui.item.value);  // This will disappear when the next line executes, but the eye can sometimes catch it.
        this.submitSearch(ui.item.value);
        return false;
      }.bind(this),

      source: function(request, response) {
        Sefaria.lookup(
            request.term,
            d => {
              if (d["completions"].length > 0) {
                response(d["completions"].concat([`${this._searchOverridePre}${request.term}${this._searchOverridePost}`]))
              } else {
                response([])
              }
            },
            e => response([])
        );
      }.bind(this)
    });
  }
  showVirtualKeyboardIcon(show){
      if(document.getElementById('keyboardInputMaster')){//if keyboard is open, ignore.
        return; //this prevents the icon from flashing on every key stroke.
      }
      if(this.props.interfaceLang == 'english'){
          var opacity = show ? 0.4 : 0;
          $(ReactDOM.findDOMNode(this)).find(".keyboardInputInitiator").css({"opacity": opacity});
      }
  }
  showDesktop() {
    if (this.props.panelsOpen == 0) {
      var recentlyViewed = Sefaria.recentlyViewed;
      if (recentlyViewed && recentlyViewed.length) {
        this.handleRefClick(recentlyViewed[0].ref, recentlyViewed[0].version, recentlyViewed[0].versionLanguage);
      }
    }
    this.props.setCentralState({menuOpen: null});
    this.clearSearchBox();
  }
  showLibrary(categories) {
    this.props.showLibrary(categories);
    this.clearSearchBox();
  }
  showSearch(query) {
    query = query.trim();
    if (typeof sjs !== "undefined") {
      query = encodeURIComponent(query);
      window.location = `/search?q=${query}`;
      return;
    }
    this.props.showSearch(query);
    $(ReactDOM.findDOMNode(this)).find("input.search").sefaria_autocomplete("close");
  }
  showAccount(e) {
    e.preventDefault();
    if (typeof sjs !== "undefined") {
      window.location = "/account";
      return;
    }
    this.props.setCentralState({menuOpen: "account"});
    this.clearSearchBox();
  }
  showNotifications(e) {
    e.preventDefault();
    if (typeof sjs !== "undefined") {
      window.location = "/notifications";
      return;
    }
    this.props.setCentralState({menuOpen: "notifications"});
    this.clearSearchBox();
  }
  showUpdates() {
    // todo: not used yet
    if (typeof sjs !== "undefined") {
      window.location = "/updates";
      return;
    }
    this.props.setCentralState({menuOpen: "updates"});
    this.clearSearchBox();
  }
  showTestMessage() {
    this.props.setCentralState({showTestMessage: true});
  }
  hideTestMessage() {
    this.props.setCentralState({showTestMessage: false});
  }
  submitSearch(query) {
    var override = query.match(this._searchOverrideRegex());
    if (override) {
      if (Sefaria.site) { Sefaria.site.track.event("Search", "Search Box Navigation - Book Override", override[1]); }
      this.closeSearchAutocomplete();
      this.showSearch(override[1]);
      return;
    }

    Sefaria.lookup(query, function(d) {
      // If the query isn't recognized as a ref, but only for reasons of capitalization. Resubmit with recognizable caps.
      if (Sefaria.isACaseVariant(query, d)) {
        this.submitSearch(Sefaria.repairCaseVariant(query, d));
        return;
      }

      if (d["is_ref"]) {
        var action = d["is_book"] ? "Search Box Navigation - Book" : "Search Box Navigation - Citation";
        Sefaria.site.track.event("Search", action, query);
        this.clearSearchBox();
        this.handleRefClick(d["ref"]);  //todo: pass an onError function through here to the panel onError function which redirects to search
      } else if (d["type"] == "Person") {
        Sefaria.site.track.event("Search", "Search Box Navigation - Person", query);
        this.closeSearchAutocomplete();
        this.showPerson(d["key"]);
      } else if (d["type"] == "TocCategory") {
        Sefaria.site.track.event("Search", "Search Box Navigation - Category", query);
        this.closeSearchAutocomplete();
        this.showLibrary(d["key"]);  // "key" holds the category path
      } else {
        Sefaria.site.track.event("Search", "Search Box Search", query);
        this.closeSearchAutocomplete();
        this.showSearch(query);
      }
    }.bind(this));
  }
  closeSearchAutocomplete() {
    $(ReactDOM.findDOMNode(this)).find("input.search").sefaria_autocomplete("close");
  }
  clearSearchBox() {
    $(ReactDOM.findDOMNode(this)).find("input.search").val("").sefaria_autocomplete("close");
  }
  showPerson(key) {
    //todo: move people into React
    window.location = "/person/" + key;
  }
  handleLibraryClick(e) {
    e.preventDefault();
    if (typeof sjs !== "undefined") {
      window.location = "/texts";
      return;
    }
    if (this.state.menuOpen === "home") {
      return;
    } else if (this.state.menuOpen === "navigation" && this.state.navigationCategories.length == 0) {
      this.showDesktop();
    } else {
      this.showLibrary();
    }
    $(".wrapper").remove();
    $("#footer").remove();
  }
  handleRefClick(ref, version, versionLanguage) {
    if (this.props.headerMode) {
      window.location.assign("/" + ref);
      return;
    }
    this.props.onRefClick(ref, version, versionLanguage);
  }
  handleSearchKeyUp(event) {
    if (event.keyCode === 13) {
      var query = $(event.target).val();
      if (query) {
        this.submitSearch(query);
      }
    }
  }
  handleSearchButtonClick(event) {
    var query = $(ReactDOM.findDOMNode(this)).find(".search").val();
    if (query) {
      this.submitSearch(query);
    }
  }
  render() {
    var viewContent = this.state.menuOpen ?
                        (<ReaderPanel
                          initialState={this.state}
                          interfaceLang={this.props.interfaceLang}
                          setCentralState={this.props.setCentralState}
                          multiPanel={true}
                          onNavTextClick={this.props.onRefClick}
                          onSearchResultClick={this.props.onRefClick}
                          onRecentClick={this.props.onRecentClick}
                          setDefaultOption={this.props.setDefaultOption}
                          onQueryChange={this.props.onQueryChange}
                          updateSearchFilter={this.props.updateSearchFilter}
                          updateSearchOptionField={this.props.updateSearchOptionField}
                          updateSearchOptionSort={this.props.updateSearchOptionSort}
                          registerAvailableFilters={this.props.registerAvailableFilters}
                          setUnreadNotificationsCount={this.props.setUnreadNotificationsCount}
                          handleInAppLinkClick={this.props.handleInAppLinkClick}
                          hideNavHeader={true}
                          analyticsInitialized={this.props.analyticsInitialized}/>) : null;


    var notificationCount = Sefaria.notificationCount || 0;
    var notifcationsClasses = classNames({notifications: 1, unread: notificationCount > 0});
    var nextParam = "?next=" + encodeURIComponent(Sefaria.util.currentPath());
    var headerMessage = this.props.headerMessage ?
                          (<div className="testWarning" onClick={this.showTestMessage} >{ this.props.headerMessage }</div>) :
                          null;
    var loggedInLinks  = (<div className="accountLinks">
                            <a href="/account" className="account" onClick={this.showAccount}><img src="/static/img/user-64.png" alt="My Account"/></a>
                            <a href="/notifications" aria-label="See New Notifications" className={notifcationsClasses} onClick={this.showNotifications}>{notificationCount}</a>
                         </div>);
    var loggedOutLinks = (<div className="accountLinks">
                           <a className="login" href={"/register" + nextParam}>
                             <span className="int-en">Sign up</span>
                             <span className="int-he">הרשם</span>
                           </a>
                           <a className="login" href={"/login" + nextParam}>
                             <span className="int-en">Log in</span>
                             <span className="int-he">התחבר</span>
                           </a>
                         </div>);
    var langSearchPlaceholder = this.props.interfaceLang == 'english' ? "Search" : "חיפוש";
    var vkClassActivator = this.props.interfaceLang == 'english' ? " keyboardInput" : "";
    return (<div className="header">
              <div className="headerInner">
                <div className="headerNavSection">
                    <a href="/texts" aria-label="Toggle Text Table of Contents" className="library" onClick={this.handleLibraryClick}><i className="fa fa-bars"></i></a>
                    <div  className="searchBox">
                      <ReaderNavigationMenuSearchButton onClick={this.handleSearchButtonClick} />
                      <input className={"search"+ vkClassActivator}
                             id="searchInput"
                             placeholder={langSearchPlaceholder}
                             onKeyUp={this.handleSearchKeyUp}
                             onFocus={this.showVirtualKeyboardIcon.bind(this, true)}
                             onBlur={this.showVirtualKeyboardIcon.bind(this, false)}
                      title="Search for Texts or Keywords Here"/>
                    </div>
                </div>
                <div className="headerHomeSection">
                    <a className="home" href="/?home" ><img src="/static/img/sefaria.svg" alt="Sefaria Logo"/></a>
                </div>
                <div className="headerLinksSection">
                  { headerMessage }
                  { Sefaria.loggedIn ? loggedInLinks : loggedOutLinks }
                </div>
              </div>
              { viewContent ?
                (<div className="headerNavContent">
                  {viewContent}
                 </div>) : null}
              { this.state.showTestMessage ? <TestMessage hide={this.hideTestMessage} /> : null}
              <GlobalWarningMessage />
            </div>);
  }
}

Header.propTypes = {
  initialState:                PropTypes.object.isRequired,
  headerMode:                  PropTypes.bool,
  setCentralState:             PropTypes.func,
  interfaceLang:               PropTypes.string,
  onRefClick:                  PropTypes.func,
  onRecentClick:               PropTypes.func,
  showLibrary:                 PropTypes.func,
  showSearch:                  PropTypes.func,
  setDefaultOption:            PropTypes.func,
  onQueryChange:               PropTypes.func,
  updateSearchFilter:          PropTypes.func,
  updateSearchOptionField:     PropTypes.func,
  updateSearchOptionSort:      PropTypes.func,
  registerAvailableFilters:    PropTypes.func,
  setUnreadNotificationsCount: PropTypes.func,
  handleInAppLinkClick:        PropTypes.func,
  headerMesssage:              PropTypes.string,
  panelsOpen:                  PropTypes.number,
  analyticsInitialized:        PropTypes.bool,
};


class GlobalWarningMessage extends Component {
  close() {
    Sefaria.globalWarningMessage = null;
    this.forceUpdate();
  }
  render() {
    return Sefaria.globalWarningMessage ?
      <div id="globalWarningMessage">
        <i className='close fa fa-times' onClick={this.close}></i>
        <div dangerouslySetInnerHTML={ {__html: Sefaria.globalWarningMessage} }></div>
      </div>
      : null;
  }
}


class ReaderPanel extends Component {
  constructor(props) {
    super(props);
    // When this component is managed by a parent, all it takes is initialState
    if (props.initialState) {
      var state = this.clonePanel(props.initialState);
      state["initialAnalyticsTracked"] = false;
      this.state = state;
      return;
    }

    // When this component is independent and manages itself, it takes individual initial state props, with defaults listed here.
    this.state = {
      refs: props.initialRefs || [], // array of ref strings
      bookRef: null,
      mode: props.initialMode, // "Text", "TextAndConnections", "Connections"
      connectionsMode: props.initialConnectionsMode,
      filter: props.initialFilter || [],
      version: props.initialVersion,
      versionLanguage: props.initialVersionLanguage,
      highlightedRefs: props.initialHighlightedRefs || [],
      recentFilters: [],
      settings: props.initialState.settings || {
        language:      "bilingual",
        layoutDefault: "segmented",
        layoutTalmud:  "continuous",
        layoutTanakh:  "segmented",
        biLayout:      "stacked",
        color:         "light",
        fontSize:      62.5
      },
      menuOpen:             props.initialMenu || null, // "navigation", "book toc", "text toc", "display", "search", "sheets", "home", "compare"
      navigationCategories: props.initialNavigationCategories || [],
      navigationSheetTag:   props.initialSheetsTag || null,
      sheetsGroup:          props.initialGroup || null,
      searchQuery:          props.initialQuery || null,
      appliedSearchFilters: props.initialAppliedSearchFilters || [],
      searchFieldExact:     "exact",
      searchFieldBroad:     "naive_lemmatizer",
      searchField:          props.initialSearchField || "naive_lemmatizer",
      searchSortType:       props.initialSearchSortType || "chronological",
      selectedWords:        null,
      searchFiltersValid:   false,
      availableFilters:     [],
      filterRegistry:       {},
      orphanSearchFilters:  [],
      displaySettingsOpen:  false,
      tagSort: "count",
      mySheetSort: "date",
      initialAnalyticsTracked: false
    }
  }
  componentDidMount() {
    window.addEventListener("resize", this.setWidth);
    this.setWidth();
    this.setHeadroom();
  }
  componentWillUnmount() {
    window.removeEventListener("resize", this.setWidth);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.initialFilter && !this.props.multiPanel) {
      this.openConnectionsInPanel(nextProps.initialRefs);
    }
    if (nextProps.searchQuery && this.state.menuOpen !== "search") {
      this.openSearch(nextProps.searchQuery);
    }
    if (this.state.menuOpen !== nextProps.initialMenu) {
      this.setState({menuOpen: nextProps.initialMenu});
    }
    if (nextProps.initialState) {
      this.setState(nextProps.initialState);
    } else {
      this.setState({
        navigationCategories: nextProps.initialNavigationCategories || [],
        navigationSheetTag:   nextProps.initialSheetsTag || null
      });
    }
  }
  componentDidUpdate(prevProps, prevState) {
    this.setHeadroom();
    if (prevProps.layoutWidth !== this.props.layoutWidth) {
      this.setWidth();
    }
    this.replaceHistory = false;
  }
  conditionalSetState(state) {
    // Set state either in the central app or in the local component,
    // depending on whether a setCentralState function was given.
    if (this.props.setCentralState) {
      this.props.setCentralState(state, this.replaceHistory);
      this.replaceHistory = false;
    } else {
      this.setState(state);
    }
  }
  onError(message) {
    if (this.props.onError) {
      this.props.onError(message);
      return;
    }
    this.setState({"error": message})
  }
  clonePanel(panel) {
    // Set aside self-referential objects before cloning
    // Todo: Move the multiple instances of this out to a utils file
    if (panel.availableFilters || panel.filterRegistry) {
      var savedAttributes = {
         availableFilters: panel.availableFilters,
         searchFiltersValid: panel.searchFiltersValid,
         filterRegistry: panel.filterRegistry
      };
      panel.availableFilters = panel.searchFiltersValid = panel.filterRegistry = null;
      var newpanel = extend(Sefaria.util.clone(panel), savedAttributes);
      extend(panel, savedAttributes);
      return newpanel;
    } else {
      return Sefaria.util.clone(panel);
    }
  }
  handleBaseSegmentClick(ref) {
    if (this.state.mode === "TextAndConnections") {
      this.closeConnectionsInPanel();
    } else if (this.state.mode === "Text") {
      if (this.props.multiPanel) {
        this.props.onSegmentClick(ref);
      } else {
        this.openConnectionsInPanel(ref);
      }
    }
  }
  handleCitationClick(citationRef, textRef) {
    if (this.props.multiPanel) {
      this.props.onCitationClick(citationRef, textRef);
    } else {
      this.showBaseText(citationRef);
    }
  }
  handleTextListClick(ref) {
    this.showBaseText(ref);
  }
  setHeadroom() {
    if (this.props.multiPanel) { return; }
    var $node    = $(ReactDOM.findDOMNode(this));
    var $header  = $node.find(".readerControls");
    if (this.state.mode !== "TextAndConnections") {
      var scroller = $node.find(".textColumn")[0];
      $header.headroom({scroller: scroller});
    }
  }
  openConnectionsInPanel(ref) {
    var refs = typeof ref == "string" ? [ref] : ref;
    this.replaceHistory = this.state.mode === "TextAndConnections"; // Don't push history for change in Connections focus
    this.conditionalSetState({highlightedRefs: refs, mode: "TextAndConnections" }, this.replaceHistory);
  }
  closeConnectionsInPanel() {
    // Return to the original text in the ReaderPanel contents
    this.conditionalSetState({highlightedRefs: [], mode: "Text"});
  }
  showBaseText(ref, replaceHistory, version=null, versionLanguage=null) {
    // Set the current primary text
    // `replaceHistory` - bool whether to replace browser history rather than push for this change
    if (!ref) { return; }
    this.replaceHistory = Boolean(replaceHistory);
    if (this.state.mode == "Connections" && this.props.masterPanelLanguage == "bilingual") {
      // Connections panels are forced to be mono-lingual. When opening a text from a connections panel,
      // allow it to return to bilingual.
      this.state.settings.language = "bilingual";
    }
    this.conditionalSetState({
      mode: "Text",
      refs: [ref],
      filter: [],
      recentFilters: [],
      menuOpen: null,
      version: version,
      versionLanguage: versionLanguage,
      settings: this.state.settings
    });
  }
  updateTextColumn(refs) {
    // Change the refs in the current TextColumn, for infinite scroll up/down.
    this.replaceHistory = true;
    this.conditionalSetState({ refs: refs });
  }
  setTextListHighlight(refs) {
    refs = typeof refs === "string" ? [refs] : refs;
    this.replaceHistory = true;
    this.conditionalSetState({highlightedRefs: refs});
    if (this.props.multiPanel) {
      this.props.setTextListHighlight(refs);
    }
  }
  setSelectedWords(words){
    words = (typeof words !== "undefined" && words.length) ?  words : "";
    words = words.trim();
    this.replaceHistory = false;
    if (this.props.multiPanel) {
      this.props.setSelectedWords(words);
    } else {
      this.conditionalSetState({'selectedWords':  words});
    }
  }
  closeMenus() {
    var state = {
      // If there's no content to show, return to home
      menuOpen: this.state.refs.slice(-1)[0] ? null: "home",
      // searchQuery: null,
      // appliedSearchFilters: [],
      navigationCategories: null,
      navigationSheetTag: null
    };
    this.conditionalSetState(state);
  }
  closePanelSearch() {
    // Assumption: Search in a panel is always within a "compare" panel
    var state = {
      // If there's no content to show, return to home
      menuOpen: this.state.refs.slice(-1)[0] ? null: "compare",
      // searchQuery: null,
      // appliedSearchFilters: [],
      navigationCategories: null,
      navigationSheetTag: null
    };
    this.conditionalSetState(state);
  }
  openMenu(menu) {
    this.conditionalSetState({
      menuOpen: menu,
      initialAnalyticsTracked: false,
      // searchQuery: null,
      // appliedSearchFilters: [],
      navigationSheetTag: null,
    });
  }
  setNavigationCategories(categories) {
    this.conditionalSetState({navigationCategories: categories});
  }
  setSheetTag (tag) {
    this.conditionalSetState({navigationSheetTag: tag});
  }
  setFilter(filter, updateRecent) {
    // Sets the current filter for Connected Texts (TextList)
    // If updateRecent is true, include the current setting in the list of recent filters.
    if (this.props.setConnectionsFilter) {
      this.props.setConnectionsFilter(filter, updateRecent);
    } else {
      if (updateRecent && filter) {
        if (Sefaria.util.inArray(filter, this.state.recentFilters) !== -1) {
          this.state.recentFilters.toggle(filter);
        }
        this.state.recentFilters = [filter].concat(this.state.recentFilters);
      }
      filter = filter ? [filter] : [];
      this.conditionalSetState({recentFilters: this.state.recentFilters, filter: filter, connectionsMode: "TextList"});
    }

  }
  toggleLanguage() {
    if (this.state.settings.language == "hebrew") {
        this.setOption("language", "english");
        if (Sefaria.site) { Sefaria.site.track.event("Reader", "Change Language", "english");}
    } else {
        this.setOption("language", "hebrew");
        if (Sefaria.site) { Sefaria.site.track.event("Reader", "Change Language", "hebrew");}
    }
  }
  openSearch(query) {
    this.conditionalSetState({
      menuOpen: "search",
      searchQuery: query
    });
  }
  openDisplaySettings() {
    this.conditionalSetState({displaySettingsOpen: true});
  }
  closeDisplaySettings() {
    this.conditionalSetState({displaySettingsOpen: false});
  }
  setOption(option, value) {
    if (option === "fontSize") {
      var step = 1.15;
      var size = this.state.settings.fontSize;
      value = (value === "smaller" ? size/step : size*step);
    } else if (option === "layout") {
      var category = this.currentCategory();
      var option = category === "Tanakh" || category === "Talmud" ? "layout" + category : "layoutDefault";
    }

    this.state.settings[option] = value;
    var state = {settings: this.state.settings};
    if (option !== "fontSize") { state.displaySettingsOpen = false; }
    $.cookie(option, value, {path: "/"});
    if (option === "language") {
      $.cookie("contentLang", value, {path: "/"});
      this.replaceHistory = true;
      this.props.setDefaultOption && this.props.setDefaultOption(option, value);
    }
    this.conditionalSetState(state);
  }
  setConnectionsMode(mode) {
    var loginRequired = {
      "Add Connection": 1,
    };
    if (mode == "Add Connection" && this.props.allOpenRefs.length == 1) {
      this.props.openComparePanel(true);
      return;
    }
    Sefaria.site.track.event("Tools", mode + " Click"); // TODO Shouldn't be tracking clicks here, this function is called programmatically
    if (!Sefaria._uid && mode in loginRequired) {
      Sefaria.site.track.event("Tools", "Prompt Login");
      mode = "Login";
    }
    var state = {connectionsMode: mode};
    if (mode === "Resources") {
      this.setFilter();
    }
    this.conditionalSetState(state);
  }
  setConnectionsCategory(category) {
    this.setFilter(category, false); // Set filter so that basetext shows link dots according to this category
    this.conditionalSetState({connectionsCategory: category, connectionsMode: "ConnectionsList"});
  }
  editNote(note) {
    this.conditionalSetState({
      connectionsMode: "Edit Note",
      noteBeingEdited: note
    });
  }
  setWidth() {
    this.setState({width: $(ReactDOM.findDOMNode(this)).width()});
    //console.log("Setting panel width", this.width);
  }
  setSheetTagSort(sort) {
    this.conditionalSetState({
      tagSort: sort,
    });
  }
  setMySheetSort(sort) {
    this.conditionalSetState({
      mySheetSort: sort,
    });
  }
  currentMode() {
    return this.state.mode;
  }
  currentRef() {
    // Returns a string of the current ref, the first if there are many
    return this.state.refs && this.state.refs.length ? this.state.refs[0] : null;
  }
  lastCurrentRef() {
    // Returns a string of the current ref, the last if there are many
    var ret = this.state.refs && this.state.refs.length ? this.state.refs.slice(-1)[0] : null;
    if (ret && typeof ret == "object") {debugger;}
    return ret;
  }
  currentData() {
    // Returns the data from the library of the current ref
    var ref  = this.currentRef();
    if (!ref) { return null; }
    var data = Sefaria.ref(ref);
    return data;
  }
  currentBook() {
    var data = this.currentData();
    if (data) {
      return data.indexTitle;
    } else {
      var pRef = Sefaria.parseRef(this.currentRef());
      return "book" in pRef ? pRef.book : null;
    }
  }
  currentCategory() {
    var book = this.currentBook();
    return (Sefaria.index(book) ? Sefaria.index(book)['primary_category'] : null);
  }
  currentLayout() {
    if (this.state.settings.language == "bilingual") {
      return this.state.width > 500 ? this.state.settings.biLayout : "stacked";
    }
    var category = this.currentCategory();
    if (!category) { return "layoutDefault"; }
    var option = category === "Tanakh" || category === "Talmud" ? "layout" + category : "layoutDefault";
    return this.state.settings[option];
  }
  render() {
    if (this.state.error) {
      return (
          <div className="readerContent">
            <div className="readerError">
              <span className="int-en">Something went wrong! Please use the back button or the menus above to get back on track.</span>
              <span className="int-he">ארעה תקלה במערכת. אנא חזרו לתפריט הראשי או אחורנית על ידי שימוש בכפתורי התפריט או החזור.</span>
              <div className="readerErrorText">
                <span className="int-en">Error Message: </span>
                <span className="int-he">שגיאה:</span>
                {this.state.error}
              </div>
            </div>
          </div>
        );
    }
    var items = [];
    if (this.state.mode === "Text" || this.state.mode === "TextAndConnections") {
      items.push(<TextColumn
          srefs={this.state.refs.slice()}
          version={this.state.version}
          versionLanguage={this.state.versionLanguage}
          highlightedRefs={this.state.highlightedRefs}
          basetext={true}
          withContext={true}
          loadLinks={true}
          prefetchNextPrev={true}
          multiPanel={this.props.multiPanel}
          mode={this.state.mode}
          settings={Sefaria.util.clone(this.state.settings)}
          interfaceLang={this.props.interfaceLang}
          setOption={this.setOption}
          showBaseText={this.showBaseText}
          updateTextColumn={this.updateTextColumn}
          onSegmentClick={this.handleBaseSegmentClick}
          onCitationClick={this.handleCitationClick}
          setTextListHighlight={this.setTextListHighlight}
          setSelectedWords={this.setSelectedWords}
          panelsOpen={this.props.panelsOpen}
          layoutWidth={this.props.layoutWidth}
          filter={this.state.filter}
          key="text" />);
    }
    if (this.state.mode === "Connections" || this.state.mode === "TextAndConnections") {
      var langMode = this.props.masterPanelLanguage || this.state.settings.language;
      var data     = this.currentData();
      var canEditText = data &&
                        ((langMode === "hebrew" && data.heVersionStatus !== "locked") ||
                        (langMode === "english" && data.versionStatus !== "locked") ||
                        (Sefaria.is_moderator && langMode !== "bilingual"));
      items.push(<ConnectionsPanel
          srefs={this.state.mode === "Connections" ? this.state.refs.slice() : this.state.highlightedRefs.slice()}
          filter={this.state.filter || []}
          mode={this.state.connectionsMode || "Resources"}
          recentFilters={this.state.recentFilters}
          connectionsCategory={this.state.connectionsCategory}
          interfaceLang={this.props.interfaceLang}
          contentLang={this.state.settings.language}
          version={this.state.version}
          versionLanguage={this.state.versionLanguage}
          fullPanel={this.props.multiPanel}
          multiPanel={this.props.multiPanel}
          allOpenRefs={this.props.allOpenRefs}
          addToSourceSheet={this.props.addToSourceSheet}
          canEditText={canEditText}
          setFilter={this.setFilter}
          setConnectionsMode={this.setConnectionsMode}
          setConnectionsCategory={this.setConnectionsCategory}
          closeConectionsInPanel={this.closeConnectionsInPanel}
          openNav={this.openMenu.bind(null, "navigation")}
          openDisplaySettings={this.openDisplaySettings}
          editNote={this.editNote}
          noteBeingEdited={this.state.noteBeingEdited}
          onTextClick={this.handleTextListClick}
          onCitationClick={this.handleCitationClick}
          onNavigationClick={this.props.onNavigationClick}
          onOpenConnectionsClick={this.props.onOpenConnectionsClick}
          onCompareClick={this.showBaseText}
          openComparePanel={this.props.openComparePanel}
          closePanel={this.props.closePanel}
          selectedWords={this.state.selectedWords}
          key="connections" />
      );
    }

    if (this.state.menuOpen === "home" || this.state.menuOpen == "navigation" || this.state.menuOpen == "compare") {
      var openInPanel   = function(pos, ref) { this.showBaseText(ref) }.bind(this);
      var openNav       = this.state.menuOpen === "compare" ? this.openMenu.bind(null, "compare") : this.openMenu.bind(null, "navigation");
      var onRecentClick = this.state.menuOpen === "compare" || !this.props.onRecentClick ? openInPanel : this.props.onRecentClick;

      var menu = (<ReaderNavigationMenu
                    key={this.state.navigationCategories ? this.state.navigationCategories.join("-") : "navHome"}
                    home={this.state.menuOpen === "home"}
                    compare={this.state.menuOpen === "compare"}
                    interfaceLang={this.props.interfaceLang}
                    multiPanel={this.props.multiPanel}
                    categories={this.state.navigationCategories || []}
                    settings={this.state.settings}
                    setCategories={this.setNavigationCategories || []}
                    setOption={this.setOption}
                    toggleLanguage={this.toggleLanguage}
                    closeNav={this.closeMenus}
                    closePanel={this.props.closePanel}
                    openNav={openNav}
                    openSearch={this.openSearch}
                    openMenu={this.openMenu}
                    openDisplaySettings={this.openDisplaySettings}
                    onTextClick={this.props.onNavTextClick || this.showBaseText}
                    onRecentClick={onRecentClick}
                    hideNavHeader={this.props.hideNavHeader} />);

    }
    else if (this.state.menuOpen === "text toc") {
      var menu = (<ReaderTextTableOfContents
                    mode={this.state.menuOpen}
                    interfaceLang={this.props.interfaceLang}
                    close={this.closeMenus}
                    title={this.currentBook()}
                    version={this.state.version}
                    versionLanguage={this.state.versionLanguage}
                    settingsLanguage={this.state.settings.language == "hebrew"?"he":"en"}
                    category={this.currentCategory()}
                    narrowPanel={!this.props.multiPanel}
                    currentRef={this.lastCurrentRef()}
                    openNav={this.openMenu.bind(null, "navigation")}
                    openDisplaySettings={this.openDisplaySettings}
                    selectVersion={this.props.selectVersion}
                    showBaseText={this.showBaseText}/>);

    } else if (this.state.menuOpen === "book toc") {
      var menu = (<ReaderTextTableOfContents
                    mode={this.state.menuOpen}
                    interfaceLang={this.props.interfaceLang}
                    closePanel={this.props.closePanel}
                    close={this.closeMenus}
                    title={this.state.bookRef}
                    settingsLanguage={this.state.settings.language == "hebrew"?"he":"en"}
                    category={Sefaria.index(this.state.bookRef) ? Sefaria.index(this.state.bookRef).primary_category : null}
                    currentRef={this.state.bookRef}
                    narrowPanel={!this.props.multiPanel}
                    key={this.state.bookRef}
                    openNav={this.openMenu.bind(null, "navigation")}
                    openDisplaySettings={this.openDisplaySettings}
                    selectVersion={this.props.selectVersion}
                    showBaseText={this.showBaseText}/>);

    } else if (this.state.menuOpen === "search" && this.state.searchQuery) {
      var menu = (<SearchPage
                    query={this.state.searchQuery}
                    appliedFilters={this.state.appliedSearchFilters}
                    settings={Sefaria.util.clone(this.state.settings)}
                    onResultClick={this.props.onSearchResultClick}
                    openDisplaySettings={this.openDisplaySettings}
                    toggleLanguage={this.toggleLanguage}
                    close={this.closePanelSearch}
                    hideNavHeader={this.props.hideNavHeader}
                    onQueryChange={this.props.onQueryChange}
                    updateAppliedFilter={this.props.updateSearchFilter}
                    updateAppliedOptionField={this.props.updateSearchOptionField}
                    updateAppliedOptionSort={this.props.updateSearchOptionSort}
                    availableFilters={this.state.availableFilters}
                    filtersValid={this.state.searchFiltersValid}
                    registerAvailableFilters={this.props.registerAvailableFilters}
                    exactField={this.state.searchFieldExact}
                    broadField={this.state.searchFieldBroad}
                    field={this.state.searchField}
                    sortType={this.state.searchSortType}/>);

    } else if (this.state.menuOpen === "sheets") {
      var menu = (<SheetsNav
                    interfaceLang={this.props.interfaceLang}
                    openNav={this.openMenu.bind(null, "navigation")}
                    close={this.closeMenus}
                    multiPanel={this.props.multiPanel}
                    hideNavHeader={this.props.hideNavHeader}
                    toggleLanguage={this.toggleLanguage}
                    tag={this.state.navigationSheetTag}
                    group={this.state.sheetsGroup}
                    tagSort={this.state.tagSort}
                    mySheetSort={this.state.mySheetSort}
                    setMySheetSort={this.setMySheetSort}
                    setSheetTagSort={this.setSheetTagSort}
                    setSheetTag={this.setSheetTag}
                    key={"SheetsNav"} />);

    } else if (this.state.menuOpen === "account") {
      var menu = (<AccountPanel
                    handleInAppLinkClick={this.props.handleInAppLinkClick}
                    interfaceLang={this.props.interfaceLang} />);

    } else if (this.state.menuOpen === "notifications") {
      var menu = (<NotificationsPanel
                    setUnreadNotificationsCount={this.props.setUnreadNotificationsCount}
                    interfaceLang={this.props.interfaceLang} />);

    } else if (this.state.menuOpen === "myNotes") {
      var menu = (<MyNotesPanel
                    interfaceLang={this.props.interfaceLang}
                    multiPanel={this.props.multiPanel}
                    hideNavHeader={this.props.hideNavHeader}
                    navHome={this.openMenu.bind(null, "navigation")}
                    openDisplaySettings={this.openDisplaySettings}
                    toggleLanguage={this.toggleLanguage} />);

    } else if (this.state.menuOpen === "myGroups") {
      var menu = (<MyGroupsPanel
                    interfaceLang={this.props.interfaceLang} />);

    } else if (this.state.menuOpen === "updates") {
      var menu = (<UpdatesPanel
                    interfaceLang={this.props.interfaceLang} />);

    } else if (this.state.menuOpen === "modtools") {
      var menu = (<ModeratorToolsPanel
                    interfaceLang={this.props.interfaceLang} />);

    } else {
      var menu = null;
    }

    var classes  = {readerPanel: 1, narrowColumn: this.state.width < 730};
    classes[this.currentLayout()]             = 1;
    classes[this.state.settings.color]        = 1;
    classes[this.state.settings.language]     = 1;
    classes = classNames(classes);
    var style = {"fontSize": this.state.settings.fontSize + "%"};
    var hideReaderControls = (
        this.state.mode === "TextAndConnections" ||
        this.state.menuOpen === "text toc" ||
        this.state.menuOpen === "book toc" ||
        this.state.menuOpen === "compare" ||
        this.props.hideNavHeader
    );

    return (
      <div className={classes}>
        {hideReaderControls ? null :
        (<ReaderControls
          showBaseText={this.showBaseText}
          currentRef={this.lastCurrentRef()}
          currentMode={this.currentMode.bind(this)}
          currentCategory={this.currentCategory}
          currentBook={this.currentBook.bind(this)}
          version={this.state.version}
          versionLanguage={this.state.versionLanguage}
          multiPanel={this.props.multiPanel}
          settings={this.state.settings}
          setOption={this.setOption}
          setConnectionsMode={this.setConnectionsMode}
          setConnectionsCategory={this.setConnectionsCategory}
          openMenu={this.openMenu}
          closeMenus={this.closeMenus}
          openDisplaySettings={this.openDisplaySettings}
          currentLayout={this.currentLayout}
          onError={this.onError}
          connectionsMode={this.state.filter.length && this.state.connectionsMode === "Connections" ? "Connection Text" : this.state.connectionsMode}
          connectionsCategory={this.state.connectionsCategory}
          closePanel={this.props.closePanel}
          toggleLanguage={this.toggleLanguage}
          interfaceLang={this.props.interfaceLang}/>)}

        {(items.length > 0 && !menu) ?
            <div className="readerContent" style={style}>
              {items}
            </div>
        :""}

        {menu}
        {this.state.displaySettingsOpen ? (<ReaderDisplayOptionsMenu
                                              settings={this.state.settings}
                                              multiPanel={this.props.multiPanel}
                                              setOption={this.setOption}
                                              currentLayout={this.currentLayout}
                                              width={this.state.width}
                                              menuOpen={this.state.menuOpen} />) : null}
        {this.state.displaySettingsOpen ? (<div className="mask" onClick={this.closeDisplaySettings}></div>) : null}

      </div>
    );
  }
}

ReaderPanel.propTypes = {
  initialRefs:                 PropTypes.array,
  initialMode:                 PropTypes.string,
  initialConnectionsMode:      PropTypes.string,
  initialVersion:              PropTypes.string,
  initialVersionLanguage:      PropTypes.string,
  initialFilter:               PropTypes.array,
  initialHighlightedRefs:      PropTypes.array,
  initialMenu:                 PropTypes.string,
  initialQuery:                PropTypes.string,
  initialAppliedSearchFilters: PropTypes.array,
  initialSearchField:          PropTypes.string,
  initialSearchSortType:       PropTypes.oneOf(["relevance", "chronological"]),
  initialSheetsTag:            PropTypes.string,
  initialState:                PropTypes.object, // if present, overrides all props above
  interfaceLang:               PropTypes.string,
  setCentralState:             PropTypes.func,
  onSegmentClick:              PropTypes.func,
  onCitationClick:             PropTypes.func,
  onTextListClick:             PropTypes.func,
  onNavTextClick:              PropTypes.func,
  onRecentClick:               PropTypes.func,
  onSearchResultClick:         PropTypes.func,
  onUpdate:                    PropTypes.func,
  onError:                     PropTypes.func,
  closePanel:                  PropTypes.func,
  closeMenus:                  PropTypes.func,
  setConnectionsFilter:        PropTypes.func,
  setDefaultOption:            PropTypes.func,
  selectVersion:               PropTypes.func,
  onQueryChange:               PropTypes.func,
  updateSearchFilter:          PropTypes.func,
  updateSearchOptionField:     PropTypes.func,
  updateSearchOptionSort:      PropTypes.func,
  registerAvailableFilters:    PropTypes.func,
  openComparePanel:            PropTypes.func,
  setUnreadNotificationsCount: PropTypes.func,
  addToSourceSheet:            PropTypes.func,
  highlightedRefs:             PropTypes.array,
  hideNavHeader:               PropTypes.bool,
  multiPanel:                  PropTypes.bool,
  masterPanelLanguage:         PropTypes.string,
  panelsOpen:                  PropTypes.number,
  allOpenRefs:                 PropTypes.array,
  layoutWidth:                 PropTypes.number,
  setTextListHighlight:        PropTypes.func,
  setSelectedWords:            PropTypes.func,
  analyticsInitialized:        PropTypes.bool
};


class ReaderControls extends Component {
  // The Header of a Reader panel when looking at a text
  // contains controls for display, navigation etc.
  constructor(props) {
    super(props);
    this.state = {};
  }
  openTextToc(e) {
    e.preventDefault();
    this.props.openMenu("text toc");
  }
  componentDidMount() {
    var title     = this.props.currentRef;
    if (title) {
      var oref = Sefaria.ref(title);
      if (!oref) {
        // If we don't have this data yet, rerender when we do so we can set the Hebrew title
        var ajaxObj = Sefaria.textApi(title, {context: 1}, function(data) {
          if ("error" in data) {
            this.props.onError(data.error);
            return;
          }
          this.setState({runningQuery: null});   // This should have the effect of forcing a re-render
        }.bind(this));
        this.setState({runningQuery: ajaxObj});
      }
    }
  }
  componentWillUnmount() {
    if (this.state.runningQuery) {
      this.state.runningQuery.abort();
    }
  }
  render() {
    var title     = this.props.currentRef;
    var heTitle, categoryAttribution;

    if (title) {
      var oref    = Sefaria.ref(title);
      heTitle = oref ? oref.heTitle : "";
      categoryAttribution = oref && Sefaria.categoryAttribution(oref.categories) ?
                                  <CategoryAttribution categories={oref.categories} /> : null;
    } else {
      heTitle = "";
      categoryAttribution = null;
    }

    var mode              = this.props.currentMode();
    var hideHeader        = !this.props.multiPanel && mode === "Connections";
    var connectionsHeader = this.props.multiPanel && mode === "Connections";
    var showVersion = this.props.versionLanguage == "en" && (this.props.settings.language == "english" || this.props.settings.language == "bilingual");
    var versionTitle = this.props.version ? this.props.version.replace(/_/g," ") : "";
    var url = Sefaria.ref(title) ? "/" + Sefaria.normRef(Sefaria.ref(title).book) : Sefaria.normRef(title);
    var centerContent = connectionsHeader ?
      (<div className="readerTextToc">
          <ConnectionsPanelHeader
            connectionsMode={this.props.connectionsMode}
            previousCategory={this.props.connectionsCategory}
            multiPanel={this.props.multiPanel}
            setConnectionsMode={this.props.setConnectionsMode}
            setConnectionsCategory={this.props.setConnectionsCategory}
            closePanel={this.props.closePanel}
            toggleLanguage={this.props.toggleLanguage}
            interfaceLang={this.props.interfaceLang}/>
        </div>) :
      (<div className={"readerTextToc" + (categoryAttribution ? ' attributed' : '')} onClick={this.openTextToc}>
        <div className="readerTextTocBox">
          <a href={url}>
            { title ? (<i className="fa fa-caret-down invisible"></i>) : null }
            <span className="en">{title}</span>
            <span className="he">{heTitle}</span>
            { title ? (<i className="fa fa-caret-down"></i>) : null }
            { showVersion ? (<span className="readerTextVersion"><span className="en">{versionTitle}</span></span>) : null}
          </a>
          <div onClick={(e) => {e.stopPropagation();}}>
            {categoryAttribution}
          </div>
        </div>
      </div>);
    var leftControls = hideHeader || connectionsHeader ? null :
      (<div className="leftButtons">
          {this.props.multiPanel ? (<ReaderNavigationMenuCloseButton onClick={this.props.closePanel} />) : null}
          {this.props.multiPanel ? null : (<ReaderNavigationMenuMenuButton onClick={this.props.openMenu.bind(null, "navigation")} />)}
        </div>);
    var rightControls = hideHeader || connectionsHeader ? null :
      (<div className="rightButtons">
          <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
        </div>);
    var classes = classNames({readerControls: 1, headeroom: 1, connectionsHeader: mode == "Connections", fullPanel: this.props.multiPanel});
    var readerControls = hideHeader ? null :
        (<div className={classes}>
          <div className="readerControlsInner">
            {leftControls}
            {rightControls}
            {centerContent}
          </div>
        </div>);
    return (
      <div>
        {connectionsHeader ? null : <CategoryColorLine category={this.props.currentCategory()} />}
        {readerControls}
      </div>
    );
  }
}

ReaderControls.propTypes = {
  settings:                PropTypes.object.isRequired,
  showBaseText:            PropTypes.func.isRequired,
  setOption:               PropTypes.func.isRequired,
  setConnectionsMode:      PropTypes.func.isRequired,
  setConnectionsCategory:  PropTypes.func.isRequired,
  openMenu:                PropTypes.func.isRequired,
  openDisplaySettings:     PropTypes.func.isRequired,
  closeMenus:              PropTypes.func.isRequired,
  currentMode:             PropTypes.func.isRequired,
  currentCategory:         PropTypes.func.isRequired,
  currentBook:             PropTypes.func.isRequired,
  currentLayout:           PropTypes.func.isRequired,
  onError:                 PropTypes.func.isRequired,
  closePanel:              PropTypes.func,
  toggleLanguage:          PropTypes.func,
  currentRef:              PropTypes.string,
  version:                 PropTypes.string,
  versionLanguage:         PropTypes.string,
  connectionsMode:         PropTypes.string,
  connectionsCategory:     PropTypes.string,
  multiPanel:              PropTypes.bool,
  interfaceLang:           PropTypes.string
};


class ReaderDisplayOptionsMenu extends Component {
  render() {
    var languageOptions = [
      {name: "english",   content: "<span class='en'>A</span>", role: "radio", ariaLabel: "Show English Text" },
      {name: "bilingual", content: "<span class='en'>A</span><span class='he'>א</span>", role: "radio", ariaLabel: "Show English & Hebrew Text" },
      {name: "hebrew",    content: "<span class='he'>א</span>", role: "radio", ariaLabel: "Show Hebrew Text" }
    ];
    var languageToggle = (
        <ToggleSet
          role="radiogroup"
          ariaLabel="Language toggle"
          name="language"
          options={languageOptions}
          setOption={this.props.setOption}
          settings={this.props.settings} />);

    var layoutOptions = [
      {name: "continuous", fa: "align-justify", role: "radio", ariaLabel: "Show Text as a paragram" },
      {name: "segmented", fa: "align-left", role: "radio", ariaLabel: "Show Text segmented" },
    ];
    var biLayoutOptions = [
      {name: "stacked", content: "<img src='/static/img/stacked.png' alt='Stacked Language Toggle'/>", role: "radio", ariaLabel: "Show Hebrew & English Stacked"},
      {name: "heLeft", content: "<img src='/static/img/backs.png' alt='Hebrew Left Toggle' />", role: "radio", ariaLabel: "Show Hebrew Text Left of English Text"},
      {name: "heRight", content: "<img src='/static/img/faces.png' alt='Hebrew Right Toggle' />", role: "radio", ariaLabel: "Show Hebrew Text Right of English Text"}
    ];
    var layoutToggle = this.props.settings.language !== "bilingual" ?
      (<ToggleSet
          role="radiogroup"
          ariaLabel="text layout toggle"
          name="layout"
          options={layoutOptions}
          setOption={this.props.setOption}
          currentLayout={this.props.currentLayout}
          settings={this.props.settings} />) :
      (this.props.width > 500 ?
        <ToggleSet
          role="radiogroup"
          ariaLabel="bidirectional text layout toggle"
          name="biLayout"
          options={biLayoutOptions}
          setOption={this.props.setOption}
          currentLayout={this.props.currentLayout}
          settings={this.props.settings} /> : null);

    var colorOptions = [
      {name: "light", content: "", role: "radio", ariaLabel: "Toggle light mode" },
      {name: "sepia", content: "", role: "radio", ariaLabel: "Toggle sepia mode" },
      {name: "dark", content: "", role: "radio", ariaLabel: "Toggle dark mode" }
    ];
    var colorToggle = (
        <ToggleSet
          role="radiogroup"
          ariaLabel="Color toggle"
          name="color"
          separated={true}
          options={colorOptions}
          setOption={this.props.setOption}
          settings={this.props.settings} />);
    colorToggle = this.props.multiPanel ? null : colorToggle;

    var sizeOptions = [
      {name: "smaller", content: "Aa", role: "button", ariaLabel: "Decrease font size" },
      {name: "larger", content: "Aa", role: "button", ariaLabel: "Increase font size"  }
    ];
    var sizeToggle = (
        <ToggleSet
          role="group"
          ariaLabel="Increase/Decrease Font Size Buttons"
          name="fontSize"
          options={sizeOptions}
          setOption={this.props.setOption}
          settings={this.props.settings} />);

    if (this.props.menuOpen === "search") {
      return (<div className="readerOptionsPanel" role="dialog" tabIndex="0">
                <div className="readerOptionsPanelInner">
                  {languageToggle}
                  <div className="line"></div>
                  {sizeToggle}
                </div>
            </div>);
    } else if (this.props.menuOpen) {
      return (<div className="readerOptionsPanel"role="dialog" tabIndex="0">
                <div className="readerOptionsPanelInner">
                  {languageToggle}
                </div>
            </div>);
    } else {
      return (<div className="readerOptionsPanel"role="dialog" tabIndex="0">
                <div className="readerOptionsPanelInner">
                  {languageToggle}
                  {layoutToggle}
                  <div className="line"></div>
                  {colorToggle}
                  {sizeToggle}
                </div>
              </div>);
    }
  }
}

ReaderDisplayOptionsMenu.propTypes = {
  setOption:     PropTypes.func.isRequired,
  currentLayout: PropTypes.func.isRequired,
  menuOpen:      PropTypes.string,
  multiPanel:    PropTypes.bool.isRequired,
  width:         PropTypes.number.isRequired,
  settings:      PropTypes.object.isRequired,
};


class ReaderNavigationMenu extends Component {
  // The Navigation menu for browsing and searching texts, plus some site links.
  constructor(props) {
    super(props);

    this.width = 1000;
    this.state = {
      showMore: false
    };
  }
  componentDidMount() {
    this.setWidth();
    window.addEventListener("resize", this.setWidth);
  }
  componentWillUnmount() {
    window.removeEventListener("resize", this.setWidth);
  }
  setWidth() {
    var width = $(ReactDOM.findDOMNode(this)).width();
    // console.log("Setting RNM width: " + width);
    var winWidth = $(window).width();
    var winHeight = $(window).height();
    // console.log("Window width: " + winWidth + ", Window height: " + winHeight);
    var oldWidth = this.width;
    this.width = width;
    if ((oldWidth <= 500 && width > 500) ||
        (oldWidth > 500 && width <= 500)) {
      this.forceUpdate();
    }
  }
  navHome() {
    this.props.setCategories([]);
    this.props.openNav();
  }
  closeNav() {
    if (this.props.compare) {
      this.props.closePanel();
    } else {
      this.props.setCategories([]);
      this.props.closeNav();
    }
  }
  showMore(event) {
    event.preventDefault();
    this.setState({showMore: true});
  }
  handleClick(event) {
    if (!$(event.target).hasClass("outOfAppLink") && !$(event.target.parentElement).hasClass("outOfAppLink")) {
      event.preventDefault();
    }
    if ($(event.target).hasClass("refLink") || $(event.target).parent().hasClass("refLink")) {
      var ref = $(event.target).attr("data-ref") || $(event.target).parent().attr("data-ref");
      var pos = $(event.target).attr("data-position") || $(event.target).parent().attr("data-position");
      var version = $(event.target).attr("data-version") || $(event.target).parent().attr("data-version");
      var versionLanguage = $(event.target).attr("data-versionlanguage") || $(event.target).parent().attr("data-versionlanguage");
      if ($(event.target).hasClass("recentItem") || $(event.target).parent().hasClass("recentItem")) {
        this.props.onRecentClick(parseInt(pos), ref, version, versionLanguage);
      } else {
        this.props.onTextClick(ref, version, versionLanguage);
      }
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Navigation Text Click", ref); }
    } else if ($(event.target).hasClass("catLink") || $(event.target).parent().hasClass("catLink")) {
      var cats = $(event.target).attr("data-cats") || $(event.target).parent().attr("data-cats");
      cats = cats.split("|");
      this.props.setCategories(cats);
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Navigation Sub Category Click", cats.join(" / ")); }
    }
  }
  handleSearchKeyUp(event) {
    if (event.keyCode === 13) {
      var query = $(event.target).val();
      this.props.openSearch(query);
    }
  }
  handleSearchButtonClick(event) {
    var query = $(ReactDOM.findDOMNode(this)).find(".readerSearch").val();
    if (query) {
      this.props.openSearch(query);
    }
  }
  render() {
    if (this.props.categories.length && this.props.categories[0] == "recent") {
      return (<div onClick={this.handleClick}>
                <RecentPanel
                  multiPanel={this.props.multiPanel}
                  closeNav={this.closeNav}
                  openDisplaySettings={this.props.openDisplaySettings}
                  toggleLanguage={this.props.toggleLanguage}
                  navHome={this.navHome}
                  compare={this.props.compare}
                  hideNavHeader={this.props.hideNavHeader}
                  width={this.width}
                  interfaceLang={this.props.interfaceLang} />
              </div>);
    } else if (this.props.categories.length) {
      // List of Texts in a Category
      return (<div className="readerNavMenu" onClick={this.handleClick} >
                <ReaderNavigationCategoryMenu
                  categories={this.props.categories}
                  category={this.props.categories.slice(-1)[0]}
                  closeNav={this.closeNav}
                  setCategories={this.props.setCategories}
                  toggleLanguage={this.props.toggleLanguage}
                  openDisplaySettings={this.props.openDisplaySettings}
                  navHome={this.navHome}
                  compare={this.props.compare}
                  hideNavHeader={this.props.hideNavHeader}
                  width={this.width}
                  interfaceLang={this.props.interfaceLang} />
              </div>);
    } else {
      // Root Library Menu
      var categories = [
        "Tanakh",
        "Mishnah",
        "Talmud",
        "Midrash",
        "Halakhah",
        "Kabbalah",
        "Liturgy",
        "Philosophy",
        "Tanaitic",
        "Chasidut",
        "Musar",
        "Responsa",
        "Apocrypha",
        "Modern Works",
        "Other"
      ];
      categories = categories.map(function(cat) {
        var style = {"borderColor": Sefaria.palette.categoryColor(cat)};
        var openCat = function(e) {e.preventDefault(); this.props.setCategories([cat])}.bind(this);
        var heCat   = Sefaria.hebrewTerm(cat);
        return (<a href={`/texts/${cat}`} className="readerNavCategory" data-cat={cat} style={style} onClick={openCat}>
                    <span className="en">{cat}</span>
                    <span className="he">{heCat}</span>
                  </a>
                );
      }.bind(this));
      var more = (<a href="#" className="readerNavCategory readerNavMore" style={{"borderColor": Sefaria.palette.colors.darkblue}} onClick={this.showMore}>
                      <span className="en">More <img src="/static/img/arrow-right.png" alt="" /></span>
                      <span className="he">עוד <img src="/static/img/arrow-left.png" alt="" /></span>
                  </a>);
      var nCats  = this.width < 500 ? 9 : 8;
      categories = this.state.showMore ? categories : categories.slice(0, nCats).concat(more);
      categories = (<div className="readerNavCategories"><TwoOrThreeBox content={categories} width={this.width} /></div>);


      var siteLinks = Sefaria._uid ?
                    [(<a className="siteLink outOfAppLink" key='profile' href="/my/profile">
                        <i className="fa fa-user"></i>
                        <span className="en">Your Profile</span>
                        <span className="he">הפרופיל שלי</span>
                      </a>),
                     (<span className='divider' key="d1">•</span>),
                     (<a className="siteLink outOfAppLink" key='about' href="/about">
                        <span className="en">About Sefaria</span>
                        <span className="he">אודות ספאריה</span>
                      </a>),
                     (<span className='divider' key="d2">•</span>),
                     (<a className="siteLink outOfAppLink" key='logout' href="/logout">
                        <span className="en">Logout</span>
                        <span className="he">התנתק</span>
                      </a>)] :

                    [(<a className="siteLink outOfAppLink" key='about' href="/about">
                        <span className="en">About Sefaria</span>
                        <span className="he">אודות ספאריה</span>
                      </a>),
                     (<span className='divider' key="d1">•</span>),
                     (<a className="siteLink outOfAppLink" key='login' href="/login">
                        <span className="en">Sign In</span>
                        <span className="he">התחבר</span>
                      </a>)];
      siteLinks = (<div className="siteLinks">
                    {siteLinks}
                  </div>);

      var calendar = Sefaria.calendar ?
                     [(<TextBlockLink sref={Sefaria.calendar.parasha} title={Sefaria.calendar.parashaName} heTitle={Sefaria.calendar.heParashaName} category="Tanakh" />),
                      (<TextBlockLink sref={Sefaria.calendar.haftara} title="Haftara" heTitle="הפטרה" category="Tanakh" />),
                      (<TextBlockLink sref={Sefaria.calendar.daf_yomi} title="Daf Yomi" heTitle="דף יומי" category="Talmud" />)] : [];
      calendar = (<div className="readerNavCalendar"><TwoOrThreeBox content={calendar} width={this.width} /></div>);


      var sheetsStyle = {"borderColor": Sefaria.palette.categoryColor("Sheets")};
      var resources = [(<a className="resourcesLink" style={sheetsStyle} href="/sheets" onClick={this.props.openMenu.bind(null, "sheets")}>
                        <img src="/static/img/sheet-icon.png" alt="" />
                        <span className="int-en">Source Sheets</span>
                        <span className="int-he">דפי מקורות</span>
                      </a>),
                     (<a className="resourcesLink outOfAppLink" style={sheetsStyle} href="/visualizations">
                        <img src="/static/img/visualizations-icon.png" alt="" />
                        <span className="int-en">Visualizations</span>
                        <span className="int-he">חזותיים</span>
                      </a>),
                    (<a className="resourcesLink outOfAppLink" style={sheetsStyle} href="/people">
                        <img src="/static/img/authors-icon.png" alt="" />
                        <span className="int-en">Authors</span>
                        <span className="int-he">רשימת מחברים</span>
                      </a>)];
      resources = (<div className="readerNavCalendar"><TwoOrThreeBox content={resources} width={this.width} /></div>);


      var topContent = this.props.home ?
              (<div className="readerNavTop search">
                <CategoryColorLine category="Other" />
                <ReaderNavigationMenuSearchButton onClick={this.navHome} />
                <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
                <div className='sefariaLogo'><img src="/static/img/sefaria.svg" alt="Sefaria Logo" /></div>
              </div>) :
              (<div className="readerNavTop search">
                <CategoryColorLine category="Other" />
                <ReaderNavigationMenuCloseButton onClick={this.closeNav} icon={this.props.compare ? "chevron" : null} />
                <ReaderNavigationMenuSearchButton onClick={this.handleSearchButtonClick} />
                <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
                <input id="searchInput" className="readerSearch" title="Search for Texts or Keywords Here" placeholder="Search" onKeyUp={this.handleSearchKeyUp} />
              </div>);
      topContent = this.props.hideNavHeader ? null : topContent;


      var nRecent = this.width < 500 ? 4 : 6;
      var recentlyViewed = Sefaria.recentlyViewed;
      var hasMore = recentlyViewed.length > nRecent;
      recentlyViewed = recentlyViewed.slice(0, hasMore ? nRecent-1 : nRecent)
        .map(function(item) {
          return (<TextBlockLink
                    sref={item.ref}
                    heRef={item.heRef}
                    book={item.book}
                    version={item.version}
                    versionLanguage={item.versionLanguage}
                    showSections={true}
                    recentItem={true} />)
          });
      if (hasMore) {
        recentlyViewed.push(
          <a href="/texts/recent" className="readerNavCategory readerNavMore" style={{"borderColor": Sefaria.palette.colors.darkblue}} onClick={this.props.setCategories.bind(null, ["recent"])}>
            <span className="en">More <img src="/static/img/arrow-right.png" alt="" /></span>
            <span className="he">עוד <img src="/static/img/arrow-left.png" alt=""  /></span>
          </a>);
      }
      recentlyViewed = recentlyViewed.length ? <TwoOrThreeBox content={recentlyViewed} width={this.width} /> : null;

      var title = (<h1>
                    { this.props.multiPanel ? <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} /> : null }
                    <span className="int-en">The Sefaria Library</span>
                    <span className="int-he">האוסף של ספאריה</span>
                  </h1>);

      var footer = this.props.compare ? null :
                    (<footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                      <Footer />
                    </footer> );
      var classes = classNames({readerNavMenu:1, noHeader: !this.props.hideHeader, compare: this.props.compare, home: this.props.home });
      var contentClasses = classNames({content: 1, hasFooter: footer != null});
      return(<div className={classes} onClick={this.handleClick} key="0">
              {topContent}
              <div className={contentClasses}>
                <div className="contentInner">
                  { this.props.compare ? null : title }
                  <ReaderNavigationMenuSection title="Recent" heTitle="נצפו לאחרונה" content={recentlyViewed} />
                  <ReaderNavigationMenuSection title="Browse" heTitle="טקסטים" content={categories} />
                  <ReaderNavigationMenuSection title="Calendar" heTitle="לוח יומי" content={calendar} />
                  { this.props.compare ? null : (<ReaderNavigationMenuSection title="Resources" heTitle="קהילה" content={resources} />) }
                  { this.props.multiPanel ? null : siteLinks }
                </div>
                {footer}
              </div>
            </div>);
    }
  }
}

ReaderNavigationMenu.propTypes = {
  categories:    PropTypes.array.isRequired,
  settings:      PropTypes.object.isRequired,
  setCategories: PropTypes.func.isRequired,
  setOption:     PropTypes.func.isRequired,
  closeNav:      PropTypes.func.isRequired,
  openNav:       PropTypes.func.isRequired,
  openSearch:    PropTypes.func.isRequired,
  openMenu:      PropTypes.func.isRequired,
  onTextClick:   PropTypes.func.isRequired,
  onRecentClick: PropTypes.func.isRequired,
  closePanel:    PropTypes.func,
  hideNavHeader: PropTypes.bool,
  multiPanel:    PropTypes.bool,
  home:          PropTypes.bool,
  compare:       PropTypes.bool
};


class ReaderNavigationMenuSection extends Component {
  render() {
    if (!this.props.content) { return null; }
    return (
      <div className="readerNavSection">

        {this.props.title ? (<h2>
          <span className="int-en">{this.props.title}</span>
          <span className="int-he">{this.props.heTitle}</span>
        </h2>) : null }
        {this.props.content}
      </div>
      );
  }
}

ReaderNavigationMenuSection.propTypes = {
  title:   PropTypes.string,
  heTitle: PropTypes.string,
  content: PropTypes.object
};

class TextBlockLink extends Component {
  // Monopoly card style link with category color at top
  render() {
    var index    = Sefaria.index(this.props.book);
    var category = this.props.category || (index ? index.primary_category : "Other");
    var style    = {"borderColor": Sefaria.palette.categoryColor(category)};
    var title    = this.props.title   || (this.props.showSections ? this.props.sref : this.props.book);
    var heTitle  = this.props.heTitle || (this.props.showSections ? this.props.heRef : index.heTitle);

    var position = this.props.position || 0;
    var classes  = classNames({refLink: 1, blockLink: 1, recentItem: this.props.recentItem});
    var url      = "/" + Sefaria.normRef(this.props.sref) + (this.props.version?`/${this.props.versionLanguage}/${this.props.version}`:"");
    return (<a href={url} className={classes} data-ref={this.props.sref} data-version={this.props.version} data-versionlanguage={this.props.versionLanguage} data-position={position} style={style}>
              <span className="en">{title}</span>
              <span className="he">{heTitle}</span>
             </a>);
  }
}

TextBlockLink.propTypes = {
  sref:            PropTypes.string.isRequired,
  version:         PropTypes.string,
  versionLanguage: PropTypes.string,
  heRef:           PropTypes.string,
  book:            PropTypes.string,
  category:        PropTypes.string,
  title:           PropTypes.string,
  heTitle:         PropTypes.string,
  showSections:    PropTypes.bool,
  recentItem:      PropTypes.bool,
  position:        PropTypes.number
};


class LanguageToggleButton extends Component {
  toggle(e) {
    e.preventDefault();
    this.props.toggleLanguage();
  }
  render() {
    var url = this.props.url || "";
    return (<a href={url} className="languageToggle" onClick={this.toggle}>
              <span className="en"><img src="/static/img/aleph.svg" alt="Hebrew Language Toggle Icon" /></span>
              <span className="he"><img src="/static/img/aye.svg" alt="English Language Toggle Icon" /></span>
            </a>);
  }
}

LanguageToggleButton.propTypes = {
  toggleLanguage: PropTypes.func.isRequired,
  url:            PropTypes.string,
};


class BlockLink extends Component {
  render() {
    var interfaceClass = this.props.interfaceLink ? 'int-' : '';
    var classes = classNames({blockLink: 1, inAppLink: this.props.inAppLink})
    return (<a className={classes} href={this.props.target}>
              {this.props.image ? <img src={this.props.image} alt="" /> : null}
              <span className={`${interfaceClass}en`}>{this.props.title}</span>
              <span className={`${interfaceClass}he`}>{this.props.heTitle}</span>
           </a>);
  }
}

BlockLink.propTypes = {
  title:         PropTypes.string,
  heTitle:       PropTypes.string,
  target:        PropTypes.string,
  image:         PropTypes.string,
  inAppLink:     PropTypes.bool,
  interfaceLink: PropTypes.bool
};

BlockLink.defaultProps = {
  interfaceLink: false
};


class ReaderNavigationCategoryMenu extends Component {
  // Navigation Menu for a single category of texts (e.g., "Tanakh", "Bavli")
  render() {
    var footer = this.props.compare ? null :
                    (<footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                      <Footer />
                    </footer> );
    // Show Talmud with Toggles
    var categories  = this.props.categories[0] === "Talmud" && this.props.categories.length == 1 ?
                        ["Talmud", "Bavli"] : this.props.categories;

    if (categories[0] === "Talmud" && categories.length <= 2) {
      var setBavli = function() {
        this.props.setCategories(["Talmud", "Bavli"]);
      }.bind(this);
      var setYerushalmi = function() {
        this.props.setCategories(["Talmud", "Yerushalmi"]);
      }.bind(this);
      var bClasses = classNames({navToggle:1, active: categories[1] === "Bavli"});
      var yClasses = classNames({navToggle:1, active: categories[1] === "Yerushalmi", second: 1});

      var toggle =(<div className="navToggles">
                            <span className={bClasses} onClick={setBavli}>
                              <span className="en">Bavli</span>
                              <span className="he">בבלי</span>
                            </span>
                            <span className="navTogglesDivider">|</span>
                            <span className={yClasses} onClick={setYerushalmi}>
                              <span className="en">Yerushalmi</span>
                              <span className="he">ירושלמי</span>
                            </span>
                         </div>);
      var catTitle = (categories.length > 1) ? categories[0] +  " " + categories[1] : categories[0];
      var heCatTitle = (categories.length > 1) ? Sefaria.hebrewTerm(categories[0]) + " " + Sefaria.hebrewTerm(categories[1]): categories[0];
    } else {
      var toggle = null;
      var catTitle = this.props.category;
      var heCatTitle = Sefaria.hebrewTerm(this.props.category);
    }
    var catContents    = Sefaria.tocItemsByCategories(categories);
    var navMenuClasses = classNames({readerNavCategoryMenu: 1, readerNavMenu: 1, noHeader: this.props.hideNavHeader});
    var navTopClasses  = classNames({readerNavTop: 1, searchOnly: 1, colorLineOnly: this.props.hideNavHeader});
    var contentClasses = classNames({content: 1, hasFooter: footer != null});
    return (<div className={navMenuClasses}>
              <div className={navTopClasses}>
                <CategoryColorLine category={categories[0]} />
                {this.props.hideNavHeader ? null : (<ReaderNavigationMenuMenuButton onClick={this.props.navHome} compare={this.props.compare} />)}
                {this.props.hideNavHeader ? null : (<ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />)}
                {this.props.hideNavHeader ? null : (<h2>
                  <span className="en">{catTitle}</span>
                  <span className="he">{heCatTitle}</span>
                </h2>)}
              </div>
              <div className={contentClasses}>
                <div className="contentInner">
                  {this.props.hideNavHeader ? (<h1>
                      <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} />
                      <span className="en">{catTitle}</span>
                      <span className="he">{heCatTitle}</span>
                    </h1>) : null}
                  {toggle}
                  <CategoryAttribution categories={categories} />
                  <ReaderNavigationCategoryMenuContents contents={catContents} categories={categories} width={this.props.width} category={this.props.category} nestLevel={0} />
                </div>
                {footer}
              </div>
            </div>);
  }
}

ReaderNavigationCategoryMenu.propTypes = {
  category:            PropTypes.string.isRequired,
  categories:          PropTypes.array.isRequired,
  closeNav:            PropTypes.func.isRequired,
  setCategories:       PropTypes.func.isRequired,
  toggleLanguage:      PropTypes.func.isRequired,
  openDisplaySettings: PropTypes.func.isRequired,
  navHome:             PropTypes.func.isRequired,
  width:               PropTypes.number,
  compare:             PropTypes.bool,
  hideNavHeader:       PropTypes.bool,
  interfaceLang:       PropTypes.string
};


class ReaderNavigationCategoryMenuContents extends Component {
  // Inner content of Category menu (just category title and boxes of)
  getRenderedTextTitleString(title, heTitle){
    var whiteList = ['Midrash Mishlei', 'Midrash Tehillim', 'Midrash Tanchuma'];
    var displayCategory = this.props.category;
    var displayHeCategory = Sefaria.hebrewTerm(this.props.category);
    if (whiteList.indexOf(title) == -1){
      var replaceTitles = {
        "en": ['Jerusalem Talmud', displayCategory],
        "he": ['תלמוד ירושלמי', displayHeCategory]
      };
      var replaceOther = {
        "en" : [", ", " on ", " to ", " of "],
        "he" : [", ", " על "]
      };
      //this will replace a category name at the beginning of the title string and any connector strings (0 or 1) that follow.
      var titleRe = new RegExp(`^(${replaceTitles['en'].join("|")})(${replaceOther['en'].join("|")})?`);
      var heTitleRe = new RegExp(`^(${replaceTitles['he'].join("|")})(${replaceOther['he'].join("|")})?`);
      title   = title == displayCategory ? title : title.replace(titleRe, "");
      heTitle = heTitle == displayHeCategory ? heTitle : heTitle.replace(heTitleRe, "");
    }
    return [title, heTitle];
  }
  render() {
      var content = [];
      var cats = this.props.categories || [];
      for (var i = 0; i < this.props.contents.length; i++) {
        var item = this.props.contents[i];
        if (item.category) {
          // Category
          var newCats = cats.concat(item.category);
          // Special Case categories which should nest but normally wouldn't given their depth
          var subcats = ["Mishneh Torah", "Shulchan Arukh", "Maharal"];
          if (Sefaria.util.inArray(item.category, subcats) > -1 || this.props.nestLevel > 0) {
            if(item.contents.length == 1 && !("category" in item.contents[0])){
                var chItem = item.contents[0];
                var [title, heTitle] = this.getRenderedTextTitleString(chItem.title, chItem.heTitle);
                var url     = "/" + Sefaria.normRef(chItem.firstSection);
                content.push((<a href={url} className={'refLink blockLink sparse' + chItem.sparseness} data-ref={chItem.firstSection} key={"text." + this.props.nestLevel + "." + i}>
                                <span className='en'>{title}</span>
                                <span className='he'>{heTitle}</span>
                              </a>
                              ));
            } else {
              // Create a link to a subcategory
              url = "/texts/" + newCats.join("/");
              content.push((<a href={url} className="catLink" data-cats={newCats.join("|")} key={"cat." + this.props.nestLevel + "." + i}>
                              <span className='en'>{item.category}</span>
                              <span className='he'>{item.heCategory}</span>
                            </a>
                          ));
            }
          } else {
            // Add a Category
            content.push((<div className='category' key={"cat." + this.props.nestLevel + "." + i}>
                            <h3>
                              <span className='en'>{item.category}</span>
                              <span className='he'>{item.heCategory}</span>
                            </h3>
                            <ReaderNavigationCategoryMenuContents contents={item.contents} categories={newCats} width={this.props.width} nestLevel={this.props.nestLevel + 1} category={this.props.category}  />
                          </div>));
          }
        } else {
          // Add a Text
          var [title, heTitle] = this.getRenderedTextTitleString(item.title, item.heTitle);
          var ref = Sefaria.recentRefForText(item.title) || item.firstSection;
          var url = "/" + Sefaria.normRef(ref);
          content.push((<a href={url} className={'refLink blockLink sparse' + item.sparseness} data-ref={ref} key={"text." + this.props.nestLevel + "." + i}>
                          <span className='en'>{title}</span>
                          <span className='he'>{heTitle}</span>
                        </a>
                        ));
        }
      }
      var boxedContent = [];
      var currentRun   = [];
      for (var i = 0; i < content.length; i++) {
        // Walk through content looking for runs of texts/subcats to group together into a table
        if (content[i].type == "div") { // this is a subcategory
          if (currentRun.length) {
            boxedContent.push((<TwoOrThreeBox content={currentRun} width={this.props.width} key={i} />));
            currentRun = [];
          }
          boxedContent.push(content[i]);
        } else  { // this is a single text
          currentRun.push(content[i]);
        }
      }
      if (currentRun.length) {
        boxedContent.push((<TwoOrThreeBox content={currentRun} width={this.props.width} key={i} />));
      }
      return (<div>{boxedContent}</div>);
  }
}

ReaderNavigationCategoryMenuContents.propTypes = {
  category:   PropTypes.string.isRequired,
  contents:   PropTypes.array.isRequired,
  categories: PropTypes.array.isRequired,
  width:      PropTypes.number,
  nestLevel:  PropTypes.number
};


class ReaderTextTableOfContents extends Component {
  // Menu for the Table of Contents for a single text
  constructor(props) {
    super(props);

    this.state = {
      versions: [],
      versionsLoaded: false,
      currentVersion: null,
      showAllVersions: false,
      dlVersionTitle: null,
      dlVersionLanguage: null,
      dlVersionFormat: null,
      dlReady: false
    };
  }
  componentDidMount() {
    this.loadData();
  }
  componentDidUpdate(prevProps, prevState) {
    if ((this.props.settingsLanguage != prevProps.settingsLanguage)) {
      this.forceUpdate();
    }
  }
  getDataRef() {
    // Returns ref to be used to looking up data
    return Sefaria.sectionRef(this.props.currentRef) || this.props.currentRef;
  }
  getData() {
    // Gets data about this text from cache, which may be null.
    var data = Sefaria.text(this.getDataRef(), {context: 1, version: this.props.version, language: this.props.versionLanguage});
    return data;
  }
  loadData() {
    // Ensures data this text is in cache, rerenders after data load if needed
    var details = Sefaria.indexDetails(this.props.title);
    if (!details) {
      Sefaria.indexDetails(this.props.title, () => this.forceUpdate() );
    }
    if (this.isBookToc()) {
      var ref  = this.getDataRef();
      var versions = Sefaria.versions(ref)
      if (!versions) {
        Sefaria.versions(ref, () => this.forceUpdate() );
      }
    } else if (this.isTextToc()) {
      var ref  = this.getDataRef();
      var data = this.getData();
      if (!data) {
        Sefaria.text(
          ref,
          {context: 1, version: this.props.version, language: this.props.versionLanguage},
          () => this.forceUpdate());
      }
    }
  }
  getVersionsList() {
    if (this.isTextToc()) {
      var data = this.getData();
      if (!data) { return null; }
      return data.versions;
    } else if (this.isBookToc()) {
      return Sefaria.versions(this.props.title);
    }
  }
  getCurrentVersion() {
    // For now treat bilingual as english. TODO show attribution for 2 versions in bilingual case.
    if (this.isBookToc()) { return null; }
    var d = this.getData();
    if (!d) { return null; }
    var currentLanguage = this.props.settingsLanguage == "he" ? "he" : "en";
    if (currentLanguage == "en" && !d.text.length) {currentLanguage = "he"}
    if (currentLanguage == "he" && !d.he.length) {currentLanguage = "en"}

    var currentVersion = {
      language:            currentLanguage,
      versionTitle:        currentLanguage == "he" ? d.heVersionTitle : d.versionTitle,
      versionSource:       currentLanguage == "he" ? d.heVersionSource : d.versionSource,
      versionStatus:       currentLanguage == "he" ? d.heVersionStatus : d.versionStatus,
      license:             currentLanguage == "he" ? d.heLicense : d.license,
      sources:             currentLanguage == "he" ? d.heSources : d.sources,
      versionNotes:        currentLanguage == "he" ? d.heVersionNotes : d.versionNotes,
      digitizedBySefaria:  currentLanguage == "he" ? d.heDigitizedBySefaria : d.digitizedBySefaria
    };
    currentVersion.merged = !!(currentVersion.sources);

    return currentVersion;
  }
  handleClick(e) {
    var $a = $(e.target).closest("a");
    if ($a.length && ($a.hasClass("sectionLink") || $a.hasClass("linked"))) {
      var ref = $a.attr("data-ref");
      ref = decodeURIComponent(ref);
      ref = Sefaria.humanRef(ref);
      this.props.close();
      this.props.showBaseText(ref, false, this.props.version, this.props.versionLanguage);
      e.preventDefault();
    }
  }
  openVersion(version, language) {
    // Selects a version and closes this menu to show it.
    // Calling this functon wihtout parameters resets to default
    this.props.selectVersion(version, language);
    this.props.close();
  }
  onDlVersionSelect(event) {
    var versionTitle, versionLang;
    [versionTitle, versionLang] = event.target.value.split("/");
    this.setState({
      dlVersionTitle: versionTitle,
      dlVersionLanguage: versionLang
    });
  }
  onDlFormatSelect(event) {
    this.setState({dlVersionFormat: event.target.value});
  }
  versionDlLink() {
    return `/download/version/${this.props.title} - ${this.state.dlVersionLanguage} - ${this.state.dlVersionTitle}.${this.state.dlVersionFormat}`;
  }
  recordDownload() {
    Sefaria.site.track.event("Reader", "Version Download", `${this.props.title} / ${this.state.dlVersionTitle} / ${this.state.dlVersionLanguage} / ${this.state.dlVersionFormat}`);
    return true;
  }
  isBookToc() {
    return (this.props.mode == "book toc")
  }
  isTextToc() {
    return (this.props.mode == "text toc")
  }
  isVersionPublicDomain(v) {
    return !(v.license && v.license.startsWith("Copyright"));
  }
  render() {
    var title     = this.props.title;
    var heTitle   = Sefaria.index(title) ? Sefaria.index(title).heTitle : title;
    var category  = this.props.category;

    var currentVersionElement = null;
    var defaultVersionString = "Default Version";
    var defaultVersionObject = null;
    var versionBlocks = null;
    var downloadSection = null;

    // Text Details
    var details = Sefaria.indexDetails(this.props.title);
    var detailsSection = details ? <TextDetails index={details} narrowPanel={this.props.narrowPanel} /> : null;

    if (this.isTextToc()) {
      var sectionStrings = Sefaria.sectionString(this.props.currentRef);
      var section   = sectionStrings.en.named;
      var heSection = sectionStrings.he.named;
    }

    // Current Version (Text TOC only)
    var cv = this.getCurrentVersion();
    if (cv) {
      if (cv.merged) {
        var uniqueSources = cv.sources.filter(function(item, i, ar){ return ar.indexOf(item) === i; }).join(", ");
        defaultVersionString += " (Merged from " + uniqueSources + ")";
        currentVersionElement = (<div className="versionTitle">Merged from { uniqueSources }</div>);
      } else {
        if (!this.props.version) {
          defaultVersionObject = this.state.versions.find(v => (cv.language == v.language && cv.versionTitle == v.versionTitle));
          defaultVersionString += defaultVersionObject ? " (" + defaultVersionObject.versionTitle + ")" : "";
        }
        currentVersionElement = (<VersionBlock title={title} version={cv} currentRef={this.props.currentRef} showHistory={true}/>);
      }
    }

    // Versions List
    var versions = this.getVersionsList();

    var moderatorSection = Sefaria.is_moderator || Sefaria.is_editor ? (<ModeratorButtons title={title} />) : null;

    // Downloading
    if (versions) {
      var dlReady = (this.state.dlVersionTitle && this.state.dlVersionFormat && this.state.dlVersionLanguage);
      var dl_versions = [<option key="/" value="0" disabled>Version Settings</option>];
      var pdVersions = versions.filter(this.isVersionPublicDomain);
      if (cv && cv.merged) {
        var other_lang = cv.language == "he" ? "en" : "he";
        dl_versions = dl_versions.concat([
          <option value={"merged/" + cv.language} key={"merged/" + cv.language} data-lang={cv.language} data-version="merged">Current Merged Version ({cv.language})</option>,
          <option value={"merged/" + other_lang} key={"merged/" + other_lang} data-lang={other_lang} data-version="merged">Merged Version ({other_lang})</option>
        ]);
        dl_versions = dl_versions.concat(pdVersions.map(v =>
          <option value={v.versionTitle + "/" + v.language} key={v.versionTitle + "/" + v.language}>{v.versionTitle + " (" + v.language + ")"}</option>
        ));
      }
      else if (cv) {
        if (this.isVersionPublicDomain(cv)) {
          dl_versions.push(<option value={cv.versionTitle + "/" + cv.language} key={cv.versionTitle + "/" + cv.language}>Current Version ({cv.versionTitle + " (" + cv.language + ")"})</option>);
        }
        dl_versions = dl_versions.concat([
          <option value="merged/he" key="merged/he">Merged Version (he)</option>,
          <option value="merged/en" key="merged/en">Merged Version (en)</option>
        ]);
        dl_versions = dl_versions.concat(pdVersions.filter(v => v.language != cv.language || v.versionTitle != cv.versionTitle).map(v =>
          <option value={v.versionTitle + "/" + v.language} key={v.versionTitle + "/" + v.language}>{v.versionTitle + " (" + v.language + ")"}</option>
        ));
      }
      else {
        dl_versions = dl_versions.concat([
          <option value="merged/he" key="merged/he">Merged Version (he)</option>,
          <option value="merged/en" key="merged/en">Merged Version (en)</option>
        ]);
        dl_versions = dl_versions.concat(pdVersions.map(v =>
          <option value={v.versionTitle + "/" + v.language} key={v.versionTitle + "/" + v.language}>{v.versionTitle + " (" + v.language + ")"}</option>
        ));
      }
      var downloadButton = <div className="versionDownloadButton">
          <div className="downloadButtonInner">
            <span className="int-en">Download</span>
            <span className="int-he">הורדה</span>
          </div>
        </div>;
      var downloadSection = (
        <div className="dlSection">
          <h2 className="dlSectionTitle">
            <span className="int-en">Download Text</span>
            <span className="int-he">הורדת הטקסט</span>
          </h2>
          <select className="dlVersionSelect dlVersionTitleSelect" value={(this.state.dlVersionTitle && this.state.dlVersionLanguage)?this.state.dlVersionTitle + "/" + this.state.dlVersionLanguage:"0"} onChange={this.onDlVersionSelect}>
            {dl_versions}
          </select>
          <select className="dlVersionSelect dlVersionFormatSelect" value={this.state.dlVersionFormat || "0"} onChange={this.onDlFormatSelect}>
            <option key="none" value="0" disabled>File Format</option>
            <option key="txt" value="txt" >Text (with tags)</option>
            <option key="plain.txt" value="plain.txt" >Text (without tags)</option>
            <option key="csv" value="csv" >CSV</option>
            <option key="json" value="json" >JSON</option>
          </select>
          {dlReady?<a onClick={this.recordDownload} href={this.versionDlLink()} download>{downloadButton}</a>:downloadButton}
        </div>
      );
    }

    var closeClick = (this.isBookToc()) ? this.props.closePanel : this.props.close;
    var classes = classNames({readerTextTableOfContents:1, readerNavMenu:1, narrowPanel: this.props.narrowPanel});
    var categories = Sefaria.index(this.props.title).categories;


    return (<div className={classes}>
              <CategoryColorLine category={category} />
              <div className="readerControls">
                <div className="readerControlsInner">
                  <div className="leftButtons">
                    <ReaderNavigationMenuCloseButton onClick={closeClick}/>
                  </div>
                  <div className="rightButtons">
                    <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
                  </div>
                  <div className="readerTextToc readerTextTocHeader">
                    <div className="readerTextTocBox">
                      <span className="int-en">Table of Contents</span>
                      <span className="int-he">תוכן העניינים</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="content">
                <div className="contentInner">
                  <div className="tocTop">
                    <CategoryAttribution categories={categories} />
                    <div className="tocCategory">
                      <span className="en">{category}</span>
                      <span className="he">{Sefaria.hebrewTerm(category)}</span>
                    </div>
                    <div className="tocTitle">
                      <span className="en">{title}</span>
                      <span className="he">{heTitle}</span>
                      {moderatorSection}
                    </div>
                    {this.isTextToc()?
                      <div className="currentSection">
                        <span className="en">{section}</span>
                        <span className="he">{heSection}</span>
                      </div>
                    : null}
                    {detailsSection}
                  </div>
                  {this.isTextToc()?
                    <div className="currentVersionBox">
                      {currentVersionElement || (<LoadingMessage />)}
                    </div>
                  : null}
                  {details ?
                  <div onClick={this.handleClick}>
                    <TextTableOfContentsNavigation
                      schema={details.schema}
                      commentatorList={Sefaria.commentaryList(this.props.title)}
                      alts={details.alts}
                      versionsList={versions}
                      openVersion={this.openVersion}
                      defaultStruct={"default_struct" in details && details.default_struct in details.alts ? details.default_struct : "default"}
                      currentRef={this.props.currentRef}
                      narrowPanel={this.props.narrowPanel}
                      title={this.props.title} />
                  </div>
                  : <LoadingMessage />}
                  {downloadSection}
                </div>
              </div>
            </div>);
  }
}

ReaderTextTableOfContents.propTypes = {
  mode:             PropTypes.string.isRequired,
  title:            PropTypes.string.isRequired,
  category:         PropTypes.string.isRequired,
  currentRef:       PropTypes.string.isRequired,
  settingsLanguage: PropTypes.string.isRequired,
  versionLanguage:  PropTypes.string,
  version:          PropTypes.string,
  narrowPanel:      PropTypes.bool,
  close:            PropTypes.func.isRequired,
  openNav:          PropTypes.func.isRequired,
  showBaseText:     PropTypes.func.isRequired,
  selectVersion:    PropTypes.func
};


class TextDetails extends Component {
 render() {
    var makeDescriptionText = function(compWord, compPlace, compDate, description) {
      var composed = compPlace || compDate ? compWord + [compPlace, compDate].filter(x => !!x).join(" ") : null;
      return [composed, description].filter(x => !!x).join(". ");
    };
    var enDesc = makeDescriptionText("Composed in ", "compPlaceString" in this.props.index ? this.props.index.compPlaceString.en : null, "compDateString" in this.props.index ? this.props.index.compDateString.en : null, this.props.index.enDesc);
    var heDesc = makeDescriptionText("נוצר/נערך ב", "compPlaceString" in this.props.index ? this.props.index.compPlaceString.he : null, "compDateString" in this.props.index ? this.props.index.compDateString.he : null, this.props.index.heDesc);

    var authors = "authors" in this.props.index ? this.props.index.authors : [];

    if (!authors.length && !enDesc) { return null; }

    var initialWords = this.props.narrowPanel ? 12 : 30;

    return (
      <div className="tocDetails">
        { authors.length ?
          <div className="tocDetail">
              <span className="int-he">
                מחבר: {authors.map(author => <a key={author.en} href={"/person/" + author.en}>{author.he}</a> )}
              </span>
              <span className="int-en">
                Author: {authors.map(author => <a key={author.en} href={"/person/" + author.en}>{author.en}</a> )}
              </span>
          </div>
          : null }
        { !!enDesc ?
          <div className="tocDetail description">
              <div className="int-he">
                <ReadMoreText text={heDesc} initialWords={initialWords} />
              </div>
              <div className="int-en">
                <ReadMoreText text={enDesc} initialWords={initialWords} />
              </div>
          </div>
          : null }
      </div>);
  }
}

TextDetails.propTypes = {
  index:       PropTypes.object.isRequired,
  narrowPanel: PropTypes.bool,
};


class TextTableOfContentsNavigation extends Component {
  // The content section of the text table of contents that includes links to text sections,
  // and tabs for alternate structures, commentary and versions.
  constructor(props) {
    super(props);
    this.shrinkWrap = this.shrinkWrap.bind(this);
    this.state = {
      tab: props.defaultStruct
    };
  }
  componentDidMount() {
    this.shrinkWrap();
    window.addEventListener('resize', this.shrinkWrap);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.shrinkWrap);
  }
  componentDidUpdate(prevProps, prevState) {
    if (prevState.tab != this.state.tab &&
        this.state.tab !== "commentary" && this.state.tab != "versions") {
      this.shrinkWrap();
    }
  }
  setTab(tab) {
    this.setState({tab: tab});
  }
  shrinkWrap() {
    // Shrink the width of the container of a grid of inline-line block elements,
    // so that is is tight around its contents thus able to appear centered.
    // As far as I can tell, there's no way to do this in pure CSS.
    // TODO - flexbox should be able to solve this
    var shrink  = function(i, container) {
      var $container = $(container);
      // don't run on complex nodes without sectionlinks
      if ($container.hasClass("schema-node-toc") && !$container.find(".sectionLink").length) { return; }
      var maxWidth   = $container.parent().innerWidth();
      var itemWidth  = $container.find(".sectionLink").outerWidth(true);
      var nItems     = $container.find(".sectionLink").length;

      if (maxWidth / itemWidth > nItems) {
        var width = nItems * itemWidth;
      } else {
        var width = Math.floor(maxWidth / itemWidth) * itemWidth;
      }
      $container.width(width + "px");
    };
    var $root = $(ReactDOM.findDOMNode(this));
    if ($root.find(".tocSection").length) {             // nested simple text
      //$root.find(".tocSection").each(shrink); // Don't bother with these for now
    } else if ($root.find(".schema-node-toc").length) { // complex text or alt struct
      // $root.find(".schema-node-toc, .schema-node-contents").each(shrink);
    } else {
      $root.find(".tocLevel").each(shrink);             // Simple text, no nesting
    }
  }
  render() {
    var options = [{
      name: "default",
      text: "sectionNames" in this.props.schema ? this.props.schema.sectionNames[0] : "Contents",
      heText: "sectionNames" in this.props.schema ? Sefaria.hebrewTerm(this.props.schema.sectionNames[0]) : "תוכן",
      onPress: this.setTab.bind(null, "default")
    }];
    if (this.props.alts) {
      for (var alt in this.props.alts) {
        if (this.props.alts.hasOwnProperty(alt)) {
          options.push({
            name: alt,
            text: alt,
            heText: Sefaria.hebrewTerm(alt),
            onPress: this.setTab.bind(null, alt)
          });
        }
      }
    }
    options = options.sort(function(a, b) {
      return a.name == this.props.defaultStruct ? -1 :
              b.name == this.props.defaultStruct ? 1 : 0;
    }.bind(this));

    if (this.props.commentatorList.length) {
      options.push({
        name: "commentary",
        text: "Commentary",
        heText: "מפרשים",
        onPress: this.setTab.bind(null, "commentary")
      });
    }

    options.push({
      name: "versions",
      text: "Versions",
      heText: "גרסאות",
      onPress: this.setTab.bind(null, "versions")
    });

    var toggle = <TabbedToggleSet
                    options={options}
                    active={this.state.tab}
                    narrowPanel={this.props.narrowPanel} />;

    switch(this.state.tab) {
      case "default":
        var content = <SchemaNode
                          schema={this.props.schema}
                          addressTypes={this.props.schema.addressTypes}
                          refPath={this.props.title} />;
        break;
      case "commentary":
        var content = <CommentatorList
                        commentatorList={this.props.commentatorList}
                        title={this.props.title} />;


        break;
      case "versions":
        var content = <VersionsList
                        versionsList={this.props.versionsList}
                        openVersion={this.props.openVersion}
                        title={this.props.title}
                        currentRef={this.props.currentRef} />;
        break;
      default:
        var content = <SchemaNode
                          schema={this.props.alts[this.state.tab]}
                          addressTypes={this.props.schema.addressTypes}
                          refPath={this.props.title} />;
        break;
    }

    return (
      <div className="tocContent">
        {toggle}
        {content}
      </div>
    );
  }
}

TextTableOfContentsNavigation.propTypes = {
  schema:          PropTypes.object.isRequired,
  commentatorList: PropTypes.array,
  alts:            PropTypes.object,
  versionsList:    PropTypes.array,
  openVersion:     PropTypes.func,
  defaultStruct:   PropTypes.string,
  currentRef:      PropTypes.string,
  narrowPanel:     PropTypes.bool,
  title:           PropTypes.string.isRequired,
};


class TabbedToggleSet extends Component {
  render() {
    var options = this.props.options.map(function(option, i) {
      var classes = classNames({altStructToggle: 1, active: this.props.active === option.name});
      return (
        <div className="altStructToggleBox" key={i}>
          <span className={classes} onClick={option.onPress}>
              <span className="int-he">{option.heText}</span>
              <span className="int-en">{option.text}</span>
          </span>
        </div>
      );
    }.bind(this));

    if (this.props.narrowPanel) {
      var rows = [];
      var rowSize = options.length == 4 ? 2 : 3;
      for (var i = 0; i < options.length; i += rowSize) {
        rows.push(options.slice(i, i+rowSize));
      }
    } else {
      var rows = [options];
    }

    return (<div className="structToggles">
              {rows.map(function(row, i) {
                return (<div className="structTogglesInner" key={i}>{row}</div>);
              })}
            </div>);
  }
}

TabbedToggleSet.propTypes = {
  options:     PropTypes.array.isRequired, // array of object with `name`. `text`, `heText`, `onPress`
  active:      PropTypes.string.isRequired,
  narrowPanel: PropTypes.bool
};


class SchemaNode extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // Collapse everything except default nodes to start.
      collapsed: "nodes" in props.schema ? props.schema.nodes.map(function(node) { return !(node.default || node.includeSections) }) : []
    };
  }
  toggleCollapse(i) {
    this.state.collapsed[i] = !this.state.collapsed[i];
    this.setState({collapsed: this.state.collapsed});
  }
  render() {
    if (!("nodes" in this.props.schema)) {
      if (this.props.schema.nodeType === "JaggedArrayNode") {
        return (
          <JaggedArrayNode
            schema={this.props.schema}
            refPath={this.props.refPath} />
        );
      } else if (this.props.schema.nodeType === "ArrayMapNode") {
        return (
          <ArrayMapNode schema={this.props.schema} />
        );
      }

    } else {
      var content = this.props.schema.nodes.map(function(node, i) {
        if ("nodes" in node || ("refs" in node && node.refs.length)) {
          // SchemaNode with children (nodes) or ArrayMapNode with depth (refs)
          return (
            <div className="schema-node-toc" key={i}>
              <span className="schema-node-title" onClick={this.toggleCollapse.bind(null, i)}>
                <span className="he">{node.heTitle} <i className={"schema-node-control fa fa-angle-" + (this.state.collapsed[i] ? "left" : "down")}></i></span>
                <span className="en">{node.title} <i className={"schema-node-control fa fa-angle-" + (this.state.collapsed[i] ? "right" : "down")}></i></span>
              </span>
              {!this.state.collapsed[i] ?
              <div className="schema-node-contents">
                <SchemaNode
                  schema={node}
                  refPath={this.props.refPath + ", " + node.title} />
              </div>
              : null }
            </div>);
        } else if (node.nodeType == "ArrayMapNode") {
          // ArrayMapNode with only wholeRef
          return <ArrayMapNode schema={node} key={i} />;
        } else if (node.depth == 1 && !node.default) {
          // SchemaNode title that points straight to content
          var path = this.props.refPath + ", " + node.title;
          return (
            <a className="schema-node-toc linked" href={Sefaria.normRef(path)} data-ref={path} key={i}>
              <span className="schema-node-title">
                <span className="he">{node.heTitle}</span>
                <span className="en">{node.title}</span>
              </span>
            </a>);
        } else {
          // SchemaNode that has a JaggedArray below it
          return (
            <div className="schema-node-toc" key={i}>
              { !node.default ?
              <span className="schema-node-title" onClick={this.toggleCollapse.bind(null, i)}>
                <span className="he">{node.heTitle} <i className={"schema-node-control fa fa-angle-" + (this.state.collapsed[i] ? "left" : "down")}></i></span>
                <span className="en">{node.title} <i className={"schema-node-control fa fa-angle-" + (this.state.collapsed[i] ? "right" : "down")}></i></span>
              </span>
              : null }
              { !this.state.collapsed[i] ?
              <div className="schema-node-contents">
                <JaggedArrayNode
                  schema={node}
                  contentLang={this.props.contentLang}
                  refPath={this.props.refPath + (node.default ? "" : ", " + node.title)} />
              </div>
              : null }
            </div>);
        }
      }.bind(this));
      return (
        <div className="tocLevel">{content}</div>
      );
    }
  }
}

SchemaNode.propTypes = {
  schema:      PropTypes.object.isRequired,
  refPath:     PropTypes.string.isRequired
};

class JaggedArrayNode extends Component {
  render() {
    if ("toc_zoom" in this.props.schema) {
      var zoom = this.props.schema.toc_zoom - 1;
      return (<JaggedArrayNodeSection
                depth={this.props.schema.depth - zoom}
                sectionNames={this.props.schema.sectionNames.slice(0, -zoom)}
                addressTypes={this.props.schema.addressTypes.slice(0, -zoom)}
                contentCounts={this.props.schema.content_counts}
                refPath={this.props.refPath} />);
    }
    return (<JaggedArrayNodeSection
              depth={this.props.schema.depth}
              sectionNames={this.props.schema.sectionNames}
              addressTypes={this.props.schema.addressTypes}
              contentCounts={this.props.schema.content_counts}
              refPath={this.props.refPath} />);
  }
}

JaggedArrayNode.propTypes = {
  schema:      PropTypes.object.isRequired,
  refPath:     PropTypes.string.isRequired
};


class JaggedArrayNodeSection extends Component {
  contentCountIsEmpty(count) {
    // Returns true if count is zero or is an an array (of arrays) of zeros.
    if (typeof count == "number") { return count == 0; }
    var innerCounts = count.map(this.contentCountIsEmpty);
    return innerCounts.unique().compare([true]);
  }
  refPathTerminal(count) {
    // Returns a string to be added to the end of a section link depending on a content count
    // Used in cases of "zoomed" JaggedArrays, where `contentCounts` is deeper than `depth` so that zoomed section
    // links still point to section level.
    if (typeof count == "number") { return ""; }
    var terminal = ":";
    for (var i = 0; i < count.length; i++) {
      if (count[i]) {
        terminal += (i+1) + this.refPathTerminal(count[i]);
        break;
      }
    }
    return terminal;
  }
  render() {
    if (this.props.depth > 2) {
      var content = [];
      for (var i = 0; i < this.props.contentCounts.length; i++) {
        if (this.contentCountIsEmpty(this.props.contentCounts[i])) { continue; }
        if (this.props.addressTypes[0] === "Talmud") {
          var enSection = Sefaria.hebrew.intToDaf(i);
          var heSection = Sefaria.hebrew.encodeHebrewDaf(enSection);
        } else {
          var enSection = i+1;
          var heSection = Sefaria.hebrew.encodeHebrewNumeral(i+1);
        }
        content.push(
          <div className="tocSection" key={i}>
            <div className="sectionName">
              <span className="he">{Sefaria.hebrewTerm(this.props.sectionNames[0]) + " " +heSection}</span>
              <span className="en">{this.props.sectionNames[0] + " " + enSection}</span>
            </div>
            <JaggedArrayNodeSection
              depth={this.props.depth - 1}
              sectionNames={this.props.sectionNames.slice(1)}
              addressTypes={this.props.addressTypes.slice(1)}
              contentCounts={this.props.contentCounts[i]}
              refPath={this.props.refPath + ":" + enSection} />
          </div>);
      }
      return ( <div className="tocLevel">{content}</div> );
    }
    var contentCounts = this.props.depth == 1 ? new Array(this.props.contentCounts).fill(1) : this.props.contentCounts;
    var sectionLinks = [];
    for (var i = 0; i < contentCounts.length; i++) {
      if (this.contentCountIsEmpty(contentCounts[i])) { continue; }
      if (this.props.addressTypes[0] === "Talmud") {
        var section = Sefaria.hebrew.intToDaf(i);
        var heSection = Sefaria.hebrew.encodeHebrewDaf(section);
      } else {
        var section = i+1;
        var heSection = Sefaria.hebrew.encodeHebrewNumeral(i+1);
      }
      var ref  = (this.props.refPath + ":" + section).replace(":", " ") + this.refPathTerminal(contentCounts[i]);
      var link = (
        <a className="sectionLink" href={Sefaria.normRef(ref)} data-ref={ref} key={i}>
          <span className="he">{heSection}</span>
          <span className="en">{section}</span>
        </a>
      );
      sectionLinks.push(link);
    }
    return (
      <div className="tocLevel">{sectionLinks}</div>
    );
  }
}

JaggedArrayNodeSection.propTypes = {
  depth:           PropTypes.number.isRequired,
  sectionNames:    PropTypes.array.isRequired,
  addressTypes:    PropTypes.array.isRequired,
  contentCounts:   PropTypes.oneOfType([
                      PropTypes.array,
                      PropTypes.number
                    ]),
  refPath:         PropTypes.string.isRequired,
};


class ArrayMapNode extends Component {
  constructor(props) {
    super(props);
  }
  render() {
    if ("refs" in this.props.schema && this.props.schema.refs.length) {
      var sectionLinks = this.props.schema.refs.map(function(ref, i) {
        i += this.props.schema.offset || 0;
        if (this.props.schema.addressTypes[0] === "Talmud") {
          var section = Sefaria.hebrew.intToDaf(i);
          var heSection = Sefaria.hebrew.encodeHebrewDaf(section);
        } else {
          var section = i+1;
          var heSection = Sefaria.hebrew.encodeHebrewNumeral(i+1);
        }
        return (
          <a className="sectionLink" href={Sefaria.normRef(ref)} data-ref={ref} key={i}>
            <span className="he">{heSection}</span>
            <span className="en">{section}</span>
          </a>
        );
      }.bind(this));

      return (<div>{sectionLinks}</div>);

    } else {
      return (
        <a className="schema-node-toc linked" href={Sefaria.normRef(this.props.schema.wholeRef)} data-ref={this.props.schema.wholeRef}>
          <span className="schema-node-title">
            <span className="he">{this.props.schema.heTitle} <i className="schema-node-control fa fa-angle-left"></i></span>
            <span className="en">{this.props.schema.title} <i className="schema-node-control fa fa-angle-right"></i></span>
          </span>
        </a>);
    }
  }
}

ArrayMapNode.propTypes = {
  schema:      PropTypes.object.isRequired
};


class CommentatorList extends Component {
  render() {
    var content = this.props.commentatorList.map(function(commentator, i) {
      var ref = commentator.refs_to_base_texts[this.props.title];
      return (<a className="refLink linked" href={Sefaria.normRef(ref)} data-ref={ref} key={i}>
                <span className="he">{commentator.heCollectiveTitle}</span>
                <span className="en">{commentator.collectiveTitle}</span>
            </a>);
    }.bind(this));

    return (<TwoBox content={content} />);
  }
}

CommentatorList.propTypes = {
  commentatorList: PropTypes.array.isRequired,
  title:           PropTypes.string.isRequired,
};


class VersionsList extends Component {
  render() {
    var versions = this.props.versionsList;
    var [heVersionBlocks, enVersionBlocks] = ["he","en"].map(lang =>
     versions.filter(v => v.language == lang).map(v =>
      <VersionBlock
        title={this.props.title}
        version={v}
        currentRef={this.props.currentRef || this.props.title}
        firstSectionRef={"firstSectionRef" in v ? v.firstSectionRef : null}
        openVersion={this.props.openVersion}
        key={v.versionTitle + "/" + v.language}/>
     )
    );

    return (
      <div className="versionBlocks">
        {(!!heVersionBlocks.length) ?
          <div className="versionLanguageBlock">
            <div className="versionLanguageHeader">
              <span className="int-en">Hebrew Versions</span><span className="int-he">בעברית</span>
            </div>
            <div>{heVersionBlocks}</div>
          </div> : null}
        {(!!enVersionBlocks.length) ?
          <div className="versionLanguageBlock">
            <div className="versionLanguageHeader">
              <span className="int-en">English Versions</span><span className="int-he">באנגלית</span>
            </div>
            <div>{enVersionBlocks}</div>
          </div>: null}
      </div>);
  }
}

VersionsList.propTypes = {
  versionsList: PropTypes.array.isRequired,
  openVersion:  PropTypes.func.isRequired,
  title:        PropTypes.string.isRequired,
  currentRef:   PropTypes.string,
};


class VersionBlock extends Component {
  constructor(props) {
    super(props);
    this.updateableVersionAttributes = [
      "versionTitle",
      "versionSource",
      "versionNotes",
      "license",
      "priority",
      "digitizedBySefaria",
      "status"
    ];
    this.licenseMap = {
      "Public Domain": "https://en.wikipedia.org/wiki/Public_domain",
      "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
      "CC-BY": "https://creativecommons.org/licenses/by/3.0/",
      "CC-BY-SA": "https://creativecommons.org/licenses/by-sa/3.0/",
      "CC-BY-NC": "https://creativecommons.org/licenses/by-nc/4.0/"
    };
    var s = {
      editing: false,
      error: null,
      originalVersionTitle: props.version["versionTitle"]
    };
    this.updateableVersionAttributes.forEach(attr => s[attr] = props.version[attr]);
    this.state = s;
  }
  openVersion() {
    if (this.props.firstSectionRef) {
      window.location = "/" + this.props.firstSectionRef + "/" + this.props.version.language + "/" + this.props.version.versionTitle
    } else if (this.props.openVersion) {
      this.props.openVersion(this.props.version.versionTitle, this.props.version.language);
    }
  }
  onLicenseChange(event) {
    this.setState({license: event.target.value, "error": null});
  }
  onVersionSourceChange(event) {
    this.setState({versionSource: event.target.value, "error": null});
  }
  onVersionNotesChange(event) {
    this.setState({versionNotes: event.target.value, "error": null});
  }
  onPriorityChange(event) {
    this.setState({priority: event.target.value, "error": null});
  }
  onDigitizedBySefariaChange(event) {
    this.setState({digitizedBySefaria: event.target.checked, "error": null});
  }
  onLockedChange(event) {
    this.setState({status: event.target.checked ? "locked" : null, "error": null});
  }
  onVersionTitleChange(event) {
    this.setState({versionTitle: event.target.value, "error": null});
  }
  saveVersionUpdate(event) {
    var v = this.props.version;

    var payloadVersion = {};
    this.updateableVersionAttributes.forEach(function(attr) {
      if (this.state[attr] || this.state[attr] != this.props.version[attr]) {
        payloadVersion[attr] = this.state[attr];
      }
    }.bind(this));
    delete payloadVersion.versionTitle;
    if (this.state.versionTitle != this.state.originalVersionTitle) {
      payloadVersion.newVersionTitle = this.state.versionTitle;
    }
    this.setState({"error": "Saving.  Page will reload on success."});
    $.ajax({
      url: `/api/version/flags/${this.props.title}/${v.language}/${v.versionTitle}`,
      dataType: 'json',
      type: 'POST',
      data: {json: JSON.stringify(payloadVersion)},
      success: function(data) {
        if (data.status == "ok") {
          document.location.reload(true);
        } else {
          this.setState({error: data.error});
        }
      }.bind(this),
      error: function(xhr, status, err) {
        this.setState({error: err.toString()});
      }.bind(this)
    });
  }
  deleteVersion() {
    if (!confirm("Are you sure you want to delete this text version?")) { return; }

    var title = this.props.title;
    var url = "/api/texts/" + title + "/" + this.props.version.language + "/" + this.props.version.versionTitle;

    $.ajax({
      url: url,
      type: "DELETE",
      success: function(data) {
        if ("error" in data) {
          alert(data.error)
        } else {
          alert("Text Version Deleted.");
          window.location = "/" + Sefaria.normRef(title);
        }
      }
    }).fail(function() {
      alert("Something went wrong. Sorry!");
    });
  }
  openEditor() {
    this.setState({editing:true});
  }
  closeEditor() {
    this.setState({editing:false});
  }
  render() {
    var v = this.props.version;

    if (this.state.editing) {
      // Editing View
      var close_icon = (Sefaria.is_moderator)?<i className="fa fa-times-circle" aria-hidden="true" onClick={this.closeEditor}/>:"";

      var licenses = Object.keys(this.licenseMap);
      licenses = licenses.includes(v.license) ? licenses : [v.license].concat(licenses);

      return (
        <div className = "versionBlock">
          <div className="error">{this.state.error}</div>
          <div className="versionEditForm">

            <label htmlFor="versionTitle" className="">Version Title</label>
            {close_icon}
            <input id="versionTitle" className="" type="text" value={this.state.versionTitle} onChange={this.onVersionTitleChange} />

            <label htmlFor="versionSource">Version Source</label>
            <input id="versionSource" className="" type="text" value={this.state.versionSource} onChange={this.onVersionSourceChange} />

            <label id="license_label" htmlFor="license">License</label>
            <select id="license" className="" value={this.state.license} onChange={this.onLicenseChange}>
              {licenses.map(v => <option key={v} value={v}>{v?v:"(None Listed)"}</option>)}
            </select>

            <label id="digitzedBySefaria_label" htmlFor="digitzedBySefaria">Digitized by Sefaria</label>
            <input type="checkbox" id="digitzedBySefaria" checked={this.state.digitizedBySefaria} onChange={this.onDigitizedBySefariaChange}/>

            <label id="priority_label" htmlFor="priority">Priority</label>
            <input id="priority" className="" type="text" value={this.state.priority} onChange={this.onPriorityChange} />

            <label id="locked_label" htmlFor="locked">Locked</label>
            <input type="checkbox" id="locked" checked={this.state.status == "locked"} onChange={this.onLockedChange}/>

            <label id="versionNotes_label" htmlFor="versionNotes">VersionNotes</label>
            <textarea id="versionNotes" placeholder="Version Notes" onChange={this.onVersionNotesChange} value={this.state.versionNotes} rows="5" cols="40"/>
            <div>
              <div id="delete_button" onClick={this.deleteVersion}>Delete Version</div>
              <div id="save_button" onClick={this.saveVersionUpdate}>SAVE</div>
              <div className="clearFix"></div>
            </div>
          </div>
        </div>
      );
    } else {
      // Presentation View
      var license = this.licenseMap[v.license]?<a href={this.licenseMap[v.license]} target="_blank">{v.license}</a>:v.license;
      var digitizedBySefaria = v.digitizedBySefaria ? <a className="versionDigitizedBySefaria" href="/digitized-by-sefaria">Digitized by Sefaria</a> : "";
      var licenseLine = "";
      if (v.license && v.license != "unknown") {
        licenseLine =
          <span className="versionLicense">
            {license}
            {digitizedBySefaria?" - ":""}{digitizedBySefaria}
          </span>
        ;
      }
      var edit_icon = (Sefaria.is_moderator)?<i className="fa fa-pencil" aria-hidden="true" onClick={this.openEditor}/>:"";

      return (
        <div className = "versionBlock">
          <div className="versionTitle">
            <span onClick={this.openVersion}>{v.versionTitle}</span>
            {edit_icon}
          </div>
          <div className="versionDetails">
            <a className="versionSource" target="_blank" href={v.versionSource}>
            { Sefaria.util.parseURL(v.versionSource).host }
            </a>
            {licenseLine ? <span className="separator">-</span>: null}
            {licenseLine}
            {this.props.showHistory ? <span className="separator">-</span>: null}
            {this.props.showHistory ? <a className="versionHistoryLink" href={`/activity/${Sefaria.normRef(this.props.currentRef)}/${v.language}/${v.versionTitle && v.versionTitle.replace(/\s/g,"_")}`}>Version History&nbsp;›</a>:""}
          </div>
          {this.props.showNotes && !!v.versionNotes ? <div className="versionNotes" dangerouslySetInnerHTML={ {__html: v.versionNotes} }></div>:""}
        </div>
      );
    }

  }
}

VersionBlock.propTypes = {
  title:           PropTypes.string.isRequired,
  version:         PropTypes.object.isRequired,
  currentRef:      PropTypes.string,
  firstSectionref: PropTypes.string,
  showHistory:     PropTypes.bool,
  showNotes:       PropTypes.bool,
  openVersion:     PropTypes.func
};

VersionBlock.defaultProps = {
  showHistory: true,
  showNotes: true
};


class ModeratorButtons extends Component {
  constructor(props) {
    super(props);

    this.state = {
      expanded: false,
      message: null,
    }
  }
  expand() {
    this.setState({expanded: true});
  }
  editIndex() {
    window.location = "/edit/textinfo/" + this.props.title;
  }
  addSection() {
    window.location = "/add/" + this.props.title;
  }
  deleteIndex() {
    var title = this.props.title;

    var confirm = prompt("Are you sure you want to delete this text version? Doing so will completely delete this text from Sefaria, including all existing versions and links. This action CANNOT be undone. Type DELETE to confirm.", "");
    if (confirm !== "DELETE") {
      alert("Delete canceled.");
      return;
    }

    var url = "/api/index/" + title;
    $.ajax({
      url: url,
      type: "DELETE",
      success: function(data) {
        if ("error" in data) {
          alert(data.error)
        } else {
          alert("Text Deleted.");
          window.location = "/";
        }
      }
    }).fail(function() {
      alert("Something went wrong. Sorry!");
    });
    this.setState({message: "Deleting text (this may time a while)..."});
  }
  render() {
    if (!this.state.expanded) {
      return (<div className="moderatorSectionExpand" onClick={this.expand}>
                <i className="fa fa-cog"></i>
              </div>);
    }
    var editTextInfo = <div className="button white" onClick={this.editIndex}>
                          <span><i className="fa fa-info-circle"></i> Edit Text Info</span>
                        </div>;
    var addSection   = <div className="button white" onClick={this.addSection}>
                          <span><i className="fa fa-plus-circle"></i> Add Section</span>
                        </div>;
    var deleteText   = <div className="button white" onClick={this.deleteIndex}>
                          <span><i className="fa fa-exclamation-triangle"></i> Delete {this.props.title}</span>
                        </div>
    var textButtons = (<span className="moderatorTextButtons">
                          {Sefaria.is_moderator ? editTextInfo : null}
                          {Sefaria.is_moderator || Sefaria.is_editor ? addSection : null}
                          {Sefaria.is_moderator ? deleteText : null}
                        </span>);
    var message = this.state.message ? (<div className="moderatorSectionMessage">{this.state.message}</div>) : null;
    return (<div className="moderatorSection">
              {textButtons}
              {message}
            </div>);
  }
}

ModeratorButtons.propTypes = {
  title: PropTypes.string.isRequired,
};


class CategoryAttribution extends Component {
  render() {
    var attribution = Sefaria.categoryAttribution(this.props.categories);
    return attribution ?
      <div className="categoryAttribution">
        <a href={attribution.link} className="outOfAppLink">
          <span className="en">{attribution.english}</span>
          <span className="he">{attribution.hebrew}</span>
        </a>
      </div>
      : null;
  }
}

CategoryAttribution.propTypes = {
  categories: PropTypes.array.isRequired
};


class ReadMoreText extends Component {
  constructor(props) {
    super(props);
    this.state = {expanded: props.text.split(" ").length < props.initialWords};
  }
  render() {
    var text = this.state.expanded ? this.props.text : this.props.text.split(" ").slice(0, this.props.initialWords).join (" ") + "...";
    return <div className="readMoreText">
      {text}
      {this.state.expanded ? null :
        <span className="readMoreLink" onClick={() => this.setState({expanded: true})}>
          <span className="int-en">Read More ›</span>
          <span className="int-he">קרא עוד ›</span>
        </span>
      }
    </div>
  }
}

ReadMoreText.propTypes = {
  text: PropTypes.string.isRequired,
  initialWords: PropTypes.number,
};

ReadMoreText.defaultProps = {
  initialWords: 30
};


class SheetsNav extends Component {
  // Navigation for Sheets
  constructor(props) {
    super(props);
    this.state = {
      width: props.multiPanel ? 1000 : 400,
    };
  }
  componentDidMount() {
    this.setState({width: $(ReactDOM.findDOMNode(this)).width()});
  }
  componentWillReceiveProps(nextProps) {

  }
  changeSort(sort) {
    this.props.setSheetTagSort(sort);
    //Sefaria.sheets.tagList(this.loadTags, event.target.value);
  }
  render() {
    var enTitle = this.props.tag || "Source Sheets";
    var heTitle = this.props.tag || "דפי מקורות";

    if (this.props.tag == "My Sheets") {
      var content = (<MySheetsPage
                        hideNavHeader={this.props.hideNavHeader}
                        tagSort={this.props.tagSort}
                        mySheetSort={this.props.mySheetSort}
                        multiPanel={this.props.multiPanel}
                        setMySheetSort={this.props.setMySheetSort}
                        setSheetTag={this.props.setSheetTag}
                        setSheetTagSort={this.props.setSheetTagSort}
                        width={this.state.width} />);


    } else if (this.props.tag == "All Sheets") {
      var content = (<AllSheetsPage
                        hideNavHeader={this.props.hideNavHeader} />);

    } else if (this.props.tag == "sefaria-groups") {
      var content = (<GroupPage
                        hideNavHeader={this.props.hideNavHeader}
                        multiPanel={this.props.multiPanel}
                        group={this.props.group}
                        width={this.state.width} />);

    } else if (this.props.tag) {
      var content = (<TagSheetsPage
                        tag={this.props.tag}
                        setSheetTag={this.props.setSheetTag}
                        multiPanel={this.props.multiPanel}
                        hideNavHeader={this.props.hideNavHeader}
                        width={this.state.width} />);

    } else {
      var content = (<SheetsHomePage
                       tagSort={this.props.tagSort}
                       setSheetTag={this.props.setSheetTag}
                       setSheetTagSort={this.props.setSheetTagSort}
                       multiPanel={this.props.multiPanel}
                       hideNavHeader={this.props.hideNavHeader}
                       width={this.state.width} />);
    }

    var classes = classNames({readerNavMenu: 1, readerSheetsNav: 1, noHeader: this.props.hideNavHeader});
    return (<div className={classes}>
              <CategoryColorLine category="Sheets" />
              {this.props.hideNavHeader ? null :
                 (<div className="readerNavTop searchOnly" key="navTop">
                    <CategoryColorLine category="Sheets" />
                    <ReaderNavigationMenuMenuButton onClick={this.props.openNav} />
                    <div className="readerOptions"></div>
                    <h2>
                      <span className="int-en">{enTitle}</span>
                      <span className="int-he">{heTitle}</span>
                    </h2>
                  </div>)}
              {content}
            </div>);
  }
}

SheetsNav.propTypes = {
  multiPanel:      PropTypes.bool,
  tag:             PropTypes.string,
  tagSort:         PropTypes.string,
  close:           PropTypes.func.isRequired,
  openNav:         PropTypes.func.isRequired,
  setSheetTag:     PropTypes.func.isRequired,
  setSheetTagSort: PropTypes.func.isRequired,
  hideNavHeader:   PropTypes.bool
};


class SheetsHomePage extends Component {
  // A set of options grouped together.
  componentDidMount() {
    this.ensureData();
  }
  getTopSheetsFromCache() {
    return Sefaria.sheets.topSheets();
  }
  getSheetsFromAPI() {
     Sefaria.sheets.topSheets(this.onDataLoad);
  }
  getTagListFromCache() {
    return Sefaria.sheets.tagList(this.props.tagSort);
  }
  getTagListFromAPI() {
    Sefaria.sheets.tagList(this.props.tagSort, this.onDataLoad);
  }
  getTrendingTagsFromCache() {
    return Sefaria.sheets.trendingTags();
  }
  getTrendingTagsFromAPI() {
    Sefaria.sheets.trendingTags(this.onDataLoad);
  }
  onDataLoad(data) {
    this.forceUpdate();
  }
  ensureData() {
    if (!this.getTopSheetsFromCache()) { this.getSheetsFromAPI(); }
    if (!this.getTagListFromCache()) { this.getTagListFromAPI(); }
    if (!this.getTrendingTagsFromCache()) { this.getTrendingTagsFromAPI(); }
  }
  showYourSheets() {
    this.props.setSheetTag("My Sheets");
  }
  showAllSheets() {
    this.props.setSheetTag("All Sheets");
  }
  changeSort(sort) {
    this.props.setSheetTagSort(sort);
  }
  _type_sheet_button(en, he, on_click, active) {
    var classes = classNames({"type-button": 1, active: active});

    return <div className={classes} onClick={on_click}>
              <div className="type-button-title">
                <span className="int-en">{en}</span>
                <span className="int-he">{he}</span>
              </div>
            </div>;
  }
  render() {
    var trendingTags = this.getTrendingTagsFromCache();
    var topSheets    = this.getTopSheetsFromCache();
    if (this.props.tagSort == "trending") { var tagList  = this.getTrendingTagsFromCache(); }
    else { var tagList = this.getTagListFromCache(); }

    var makeTagButton = tag => <SheetTagButton setSheetTag={this.props.setSheetTag} tag={tag.tag} count={tag.count} key={tag.tag} />;

    var trendingTags    = trendingTags ? trendingTags.slice(0,6).map(makeTagButton) : [<LoadingMessage />];
    var tagList         = tagList ? tagList.map(makeTagButton) : [<LoadingMessage />];
    var publicSheetList = topSheets ? topSheets.map(function(sheet) {
      return (<PublicSheetListing sheet={sheet} key={sheet.id} />);
    }) : <LoadingMessage />;

    var yourSheetsButton  = Sefaria._uid ?
      (<div className="yourSheetsLink navButton" onClick={this.showYourSheets}>
        <span className="int-en">My Source Sheets <i className="fa fa-chevron-right"></i></span>
        <span className="int-he">דפי המקורות שלי <i className="fa fa-chevron-left"></i></span>
       </div>) : null;

    return (<div className="content hasFooter">
              <div className="contentInner">
                {this.props.hideNavHeader ? (<h1>
                  <span className="int-en">Source Sheets</span>
                  <span className="int-he">דפי מקורות</span>
                </h1>) : null}
                { this.props.multiPanel ? null : yourSheetsButton }

                { this.props.multiPanel ?
                  (<h2 className="splitHeader">
                    <span className="int-en">Public Sheets</span>
                    <span className="int-en actionText" onClick={this.showAllSheets}>See All <i className="fa fa-angle-right"></i></span>
                    <span className="int-he">דפי מקורות פומביים</span>
                    <span className="int-he actionText" onClick={this.showAllSheets}>צפה בהכל <i className="fa fa-angle-left"></i></span>
                  </h2>) :
                  (<h2>
                      <span className="int-en">Public Sheets</span>
                      <span className="int-he">דפי מקורות פומביים</span>
                   </h2>)}

                <div className="topSheetsBox">
                  {publicSheetList}
                </div>

                { this.props.multiPanel ? null :
                  (<h2>
                     <span className="int-en">Trending Tags</span>
                    <span className="int-he">תוויות פופולריות</span>
                   </h2>)}

                { this.props.multiPanel ? null : (<TwoOrThreeBox content={trendingTags} width={this.props.width} /> )}

                { this.props.multiPanel ? (
                    <h2 className="tagsHeader">
                      <span className="int-en">All Tags</span>
                      <span className="int-he">כל התוויות</span>
                      <div className="actionText">
                        <div className="type-buttons">
                          {this._type_sheet_button("Most Used", "הכי בשימוש", () => this.changeSort("count"), (this.props.tagSort == "count"))}
                          {this._type_sheet_button("Alphabetical", "אלפביתי", () => this.changeSort("alpha"), (this.props.tagSort == "alpha"))}
                          {this._type_sheet_button("Trending", "פופולרי", () => this.changeSort("trending"), (this.props.tagSort == "trending"))}
                        </div>
                      </div>
                    </h2>
                ) : (
                <h2>
                  <span className="en">All Tags</span>
                  <span className="he">כל התוויות</span>
                </h2>
                )}

                <TwoOrThreeBox content={tagList} width={this.props.width} />
              </div>
              <footer id="footer" className="static sans">
                    <Footer />
              </footer>
             </div>);
  }
}

SheetsHomePage.propTypes = {
  setSheetTag:     PropTypes.func.isRequired,
  setSheetTagSort: PropTypes.func.isRequired,
  hideNavHeader:   PropTypes.bool
};


class GroupPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      showTags: false,
      sheetFilterTag: null,
      sheetSort: "date",
      tab: "sheets"
    };
  }
  componentDidMount() {
    this.ensureData();
  }
  onDataLoad(data) {
    this.forceUpdate();
  }
  ensureData() {
    if (!Sefaria.groups(this.props.group)) {
      Sefaria.groups(this.props.group, this.onDataLoad);
    }
  }
  getData() {
    return Sefaria.groups(this.props.group, this.state.sheetSort);
  }
  setTab(tab) {
    this.setState({tab: tab});
  }
  toggleSheetTags() {
    this.state.showTags ? this.setState({showTags: false}) : this.setState({showTags: true});
  }
  setSheetTag(tag) {
    this.setState({sheetFilterTag: tag, showTags: false});
  }
  handleTagButtonClick (tag) {
    if (tag == this.state.sheetFilterTag) {
      this.setState({sheetFilterTag: null, showTags: false});
    } else {
      this.setSheetTag(tag);
    }
  }
  changeSheetSort(event) {
    this.setState({sheetSort: event.target.value})
  }
  memberList() {
    var group = this.getData();
    if (!group) { return null; }
    var admins = group.admins.map(function(member) {member.role = "Admin"; return member; });
    var publishers = group.publishers.map(function(member) {member.role = "Publisher"; return member; });
    var members = group.members.map(function(member) {member.role = "Member"; return member; });
    var invitations = group.invitations.map(function(member) {member.role = "Invitation"; return member; });

    return admins.concat(publishers, members, invitations);
  }
  pinSheet(sheetId) {
    if (this.pinning) { return; }
    $.post("/api/groups/" + this.props.group + "/pin-sheet/" + sheetId, function(data) {
      if ("error" in data) {
        alert(data.error);
      } else {
        Sefaria._groups[this.props.group] = data.group;
        this.onDataLoad();
      }
      this.pinning = false;
    }.bind(this)).fail(function() {
        alert("There was an error pinning your sheet.");
        this.pinning = false;
    }.bind(this));
    this.pinning = true;
  }
  render() {
    var group        = this.getData();
    var sheets       = group ? group.sheets : null;
    var groupTagList = group ? group.tags : null;
    var members      = this.memberList();
    var isMember     = members && members.filter(function(x) { return x.uid == Sefaria._uid } ).length !== 0;
    var isAdmin      = group && group.admins.filter(function(x) { return x.uid == Sefaria._uid } ).length !== 0;

    groupTagList = groupTagList ? groupTagList.map(function (tag) {
        var filterThisTag = this.handleTagButtonClick.bind(this, tag.tag);
        var classes = classNames({navButton: 1, sheetButton: 1, active: this.state.sheetFilterTag == tag.tag});
        return (<div className={classes} onClick={filterThisTag} key={tag.tag}>{tag.tag} ({tag.count})</div>);
      }.bind(this)) : null;

    sheets = sheets && this.state.sheetFilterTag ? sheets.filter(function(sheet) {
      return Sefaria.util.inArray(this.state.sheetFilterTag, sheet.tags) >= 0;
    }.bind(this)) : sheets;
    sheets = sheets ? sheets.map(function(sheet) {
      return (<GroupSheetListing
                sheet={sheet}
                pinned={group.pinnedSheets.indexOf(sheet.id) != -1}
                isAdmin={isAdmin}
                multiPanel={this.props.multiPanel}
                pinSheet={this.pinSheet.bind(null, sheet.id)}
                setSheetTag={this.setSheetTag}
                key={sheet.id} />);
    }.bind(this)) : <LoadingMessage />;

    return (<div className="content groupPage sheetList hasFooter">
              <div className="contentInner">

                {group.imageUrl ?
                  <img className="groupImage" src={group.imageUrl} alt={this.props.group}/>
                  : null }

                <div className="groupInfo">
                  <h1>
                    <span className="int-en">{this.props.group}</span>
                    <span className="int-he">{this.props.group}</span>
                  </h1>

                  {group.websiteUrl ?
                    <a className="groupWebsite" target="_blank" href={group.websiteUrl}>{group.websiteUrl}</a>
                    : null }

                  {group.description ?
                    <div className="groupDescription">{group.description}</div>
                    : null }
                </div>

                <div className="tabs">
                  <a className={classNames({bubbleTab: 1, active: this.state.tab == "sheets"})} onClick={this.setTab.bind(null, "sheets")}>
                    <span className="int-en">Sheets</span>
                    <span className="int-he">דפי מקורות</span>
                  </a>
                  <a className={classNames({bubbleTab: 1, active: this.state.tab == "members"})} onClick={this.setTab.bind(null, "members")}>
                    <span className="int-en">Members</span>
                    <span className="int-he">חברים</span>
                  </a>
                  { isAdmin ?
                    <a className="bubbleTab" href={"/groups/" + this.props.group.replace(/\s/g, "-") + "/settings"}>
                      <span className="int-en">Settings</span>
                      <span className="int-he">הגדרות</span>
                    </a>
                    : null }
                </div>

                { this.state.tab == "sheets" ?
                  <div>
                    {sheets.length ?
                    <h2 className="splitHeader">
                      { groupTagList && groupTagList.length ?
                      <span className="filterByTag" onClick={this.toggleSheetTags}>
                        <span className="int-en" >Filter By Tag <i className="fa fa-angle-down"></i></span>
                        <span className="int-he">סנן לפי תווית<i className="fa fa-angle-down"></i></span>
                       </span>
                       : null }

                          <span className="int-en actionText">Sort By:
                            <select value={this.state.sheetSort} onChange={this.changeSheetSort}>
                             <option value="date">Recent</option>
                             <option value="alphabetical">Alphabetical</option>
                             <option value="views">Most Viewed</option>
                           </select> <i className="fa fa-angle-down"></i></span>
                          <span className="int-he actionText">סנן לפי:
                            <select value={this.state.sheetSort} onChange={this.changeSheetSort}>
                             <option value="date">הכי חדש</option>
                             <option value="alphabetical">Alphabetical</option>
                             <option value="views">הכי נצפה</option>
                           </select> <i className="fa fa-angle-down"></i></span>
                    </h2>
                    : null }

                  {this.state.showTags ? <TwoOrThreeBox content={groupTagList} width={this.props.width} /> : null}

                  {sheets.length ?
                    sheets
                    : (isMember ?
                          <div className="emptyMessage">
                            <span className="int-en">There are no sheets in this group yet. <a href="/sheets/new">Start a sheet</a>.</span>
                            <span className="int-he"> לא קיימים דפי מקורות בקבוצה <a href="/sheets/new">צור דף מקורות</a>.</span>
                          </div>
                        : <div className="emptyMessage">
                            <span className="int-en">There are no public sheets in this group yet.</span>
                            <span className="int-he">לא קיימים דפי מקורות פומביים בקבוצה</span>
                          </div>)}
                  </div>
                  : null }

                  {this.state.tab == "members" ?
                    <div>
                     {isAdmin ? <GroupInvitationBox groupName={this.props.group} onDataChange={this.onDataLoad}/> : null }
                     { members.map(function(member) {
                      return <GroupMemberListing
                                member={member}
                                isAdmin={isAdmin}
                                isSelf={member.uid == Sefaria._uid}
                                groupName={this.props.group}
                                onDataChange={this.onDataLoad}
                                key={member.uid} />;
                     }.bind(this)) }
                    </div>
                  : null }

              </div>
            <footer id="footer" className="static sans">
              <Footer />
            </footer>
            </div>);
  }
}

GroupPage.propTypes = {
  group: PropTypes.string.isRequired,
  width: PropTypes.number
};


class GroupSheetListing extends Component {
  render() {
    var sheet = this.props.sheet;
    var title = sheet.title ? sheet.title.stripHtml() : "Untitled Source Sheet";
    var url = "/sheets/" + sheet.id;

    if (sheet.tags === undefined) { sheet.tags = []; }
    var tagString = sheet.tags.map(function (tag) {
          return(<SheetTagLink setSheetTag={this.props.setSheetTag} tag={tag} key={tag} />);
    }, this);


    var pinButtonClasses = classNames({groupSheetListingPinButton: 1, pinned: this.props.pinned, active: this.props.isAdmin});
    var pinMessage = this.props.pinned && this.props.isAdmin ? "Pinned Sheet - click to unpin" :
                      this.props.pinned ? "Pinned Sheet" : "Pin Sheet";
    var pinButton = <div className={pinButtonClasses} onClick={this.props.isAdmin ? this.props.pinSheet : null}>
                      <img src="/static/img/pin.svg" title={pinMessage} />
                    </div>

    return (<div className="sheet userSheet">
                {pinButton}
                <a className="sheetTitle" href={url} key={url}>{title}</a> <SheetAccessIcon sheet={sheet} />
                <div>{sheet.ownerName} · {sheet.views} Views · {sheet.modified} · <span className="tagString">{tagString}</span></div>
              </div>);

  }
}

GroupSheetListing.propTypes = {
  sheet:       PropTypes.object.isRequired,
  setSheetTag: PropTypes.func.isRequired,
  pinSheet:    PropTypes.func,
  pinned:      PropTypes.bool,
  isAdmin:     PropTypes.bool
};


class GroupInvitationBox extends Component {
  constructor(props) {
    super(props);

    this.state = {
      inviting: false,
      message: null
    };
  }
  onInviteClick() {
    if (!this.state.inviting) {
      this.inviteByEmail($("#groupInvitationInput").val());
    }
  }
  flashMessage(message) {
    this.setState({message: message});
    setTimeout(function() {
      this.setState({message: null});
    }.bind(this), 3000);
  }
  inviteByEmail(email) {
    if (!this.validateEmail(email)) {
      this.flashMessage("That isn't a valid email address.")
      return;
    }
    this.setState({inviting: true, message: "Inviting..."})
    $.post("/api/groups/" + this.props.groupName + "/invite/" + email, function(data) {
      if ("error" in data) {
        alert(data.error);
        this.setState({message: null, inviting: false});
      } else {
        Sefaria._groups[this.props.groupName] = data.group;
        $("#groupInvitationInput").val("");
        this.flashMessage(data.message);
        this.setState({inviting: false})
        this.props.onDataChange();
      }
    }.bind(this)).fail(function() {
        alert("There was an error sending your invitation.");
        this.setState({message: null, inviting: false});
    }.bind(this));
  }
  validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  }
  render() {
    return (<div className="groupInvitationBox">
                <input id="groupInvitationInput" placeholder="Email Address" />
                <div className="button" onClick={this.onInviteClick}>
                  <span className="int-en">Invite</span>
                  <span className="int-he">הזמן</span>
                </div>
                {this.state.message ?
                  <div className="groupInvitationBoxMessage">{this.state.message}</div>
                  : null}
              </div>);
  }
}

GroupInvitationBox.propTypes = {
  groupName: PropTypes.string.isRequired,
  onDataChange: PropTypes.func.isRequired,
};


class GroupMemberListing extends Component {
  render() {
    if (this.props.member.role == "Invitation") {
      return this.props.isAdmin ?
        <GroupInvitationListing
          member={this.props.member}
          groupName={this.props.groupName}
          onDataChange={this.props.onDataChange} />
        : null;
    }

    return (
      <div className="groupMemberListing">
        <a href={this.props.member.profileUrl}>
          <img className="groupMemberListingProfileImage" src={this.props.member.imageUrl} alt="" />
        </a>

        <a href={this.props.member.profileUrl} className="groupMemberListingName">
          {this.props.member.name}
        </a>

        <div className="groupMemberListingRoleBox">
          <span className="groupMemberListingRole">{this.props.member.role}</span>
          {this.props.isAdmin || this.props.isSelf ?
            <GroupMemberListingActions
              member={this.props.member}
              groupName={this.props.groupName}
              isAdmin={this.props.isAdmin}
              isSelf={this.props.isSelf}
              onDataChange={this.props.onDataChange} />
            : null }
        </div>

      </div>);
  }
}

GroupMemberListing.propTypes ={
  member:       PropTypes.object.isRequired,
  isAdmin:      PropTypes.bool,
  isSelf:       PropTypes.bool,
  groupName:    PropTypes.string,
  onDataChange: PropTypes.func,
};


class GroupInvitationListing extends Component {
  render() {
    return (
      <div className="groupMemberListing">
        <span className="groupInvitationListing">
          {this.props.member.email}
        </span>

        <div className="groupMemberListingRoleBox">
          <span className="groupMemberListingRole">Invited</span>
          <GroupMemberListingActions
            member={this.props.member}
            groupName={this.props.groupName}
            isInvitation={true}
            onDataChange={this.props.onDataChange} />
        </div>

      </div>);
  }
}

GroupInvitationListing.propTypes = {
  member:       PropTypes.object.isRequired,
  groupName:    PropTypes.string,
  onDataChange: PropTypes.func,
};


class GroupMemberListingActions extends Component {
  constructor(props) {
    super(props);

    this.state = {
      menuOpen: false,
      invitationResent: false
    };
  }
  toggleMenu() {
    this.setState({menuOpen: !this.state.menuOpen});
  }
  setRole(role) {
    if (this.props.isSelf && this.props.isAdmin && role !== "admin") {
      if (!confirm("Are you want to change your group role? You won't be able to undo this action unless another admin restores your permissions.")) {
        return;
      }
    }

    $.post("/api/groups/" + this.props.groupName + "/set-role/" + this.props.member.uid + "/" + role, function(data) {
      if ("error" in data) {
        alert(data.error)
      } else {
        Sefaria._groups[data.name] = data;
        this.props.onDataChange();
      }
    }.bind(this));
  }
  removeMember() {
    var message = this.props.isSelf ?
      "Are you sure you want to leave this group?" :
      "Are you sure you want to remove " + this.props.member.name + " from this group?";

    if (confirm(message)) {
      this.setRole("remove");
    }
  }
  resendInvitation() {
    $.post("/api/groups/" + this.props.groupName + "/invite/" + this.props.member.email, function(data) {
      if ("error" in data) {
        alert(data.error)
      } else {
        Sefaria._groups[this.props.groupName] = data.group;
        this.props.onDataChange();
        this.setState({"invitationResent": true});
      }
    }.bind(this));
  }
  removeInvitation() {
    if (confirm("Are you sure you want to remove this invitation?")) {
      $.post("/api/groups/" + this.props.groupName + "/invite/" + this.props.member.email + "/uninvite", function(data) {
        if ("error" in data) {
          alert(data.error)
        } else {
          Sefaria._groups[this.props.groupName] = data.group;
          this.props.onDataChange();
        }
      }.bind(this));
    }
  }
  render() {
    return (
      <div className="groupMemberListingActions" onClick={this.toggleMenu}>
        <div className="groupMemberListingActionsButton">
          <i className="fa fa-gear"></i>
        </div>
        {this.state.menuOpen ?
          <div className="groupMemberListingActionsMenu">
            {this.props.isAdmin ?
              <div className="action" onClick={this.setRole.bind(this, "admin")}>
                <span className={classNames({role: 1, current: this.props.member.role == "Admin"})}>Admin</span>
                - can invite & edit settings
              </div>
              : null }
            {this.props.isAdmin ?
              <div className="action" onClick={this.setRole.bind(this, "publisher")}>
                <span className={classNames({role: 1, current: this.props.member.role == "Publisher"})}>Publisher</span>
                - can publish
              </div>
              : null }
            {this.props.isAdmin ?
              <div className="action" onClick={this.setRole.bind(this, "member")}>
                <span className={classNames({role: 1, current: this.props.member.role == "Member"})}>Member</span>
                - can view & share within group
              </div>
              : null}
            {this.props.isAdmin || this.props.isSelf ?
              <div className="action" onClick={this.removeMember}>
                <span className="role">{this.props.isSelf ? "Leave Group" : "Remove"}</span>
              </div>
            : null }
            {this.props.isInvitation  && !this.state.invitationResent ?
              <div className="action" onClick={this.resendInvitation}>
                <span className="role">Resend Invitation</span>
              </div>
              : null}
            {this.props.isInvitation  && this.state.invitationResent ?
              <div className="action">
                <span className="role">Invitation Resent</span>
              </div>
              : null}
            {this.props.isInvitation ?
              <div className="action" onClick={this.removeInvitation}>
                <span className="role">Remove</span>

              </div>
              : null}
          </div>
        : null }
      </div>);
  }
}

GroupMemberListingActions.propTypes = {
  member:       PropTypes.object.isRequired,
  groupName:    PropTypes.string.isRequired,
  isAdmin:      PropTypes.bool,
  isSelf:       PropTypes.bool,
  isInvitation: PropTypes.bool,
  onDataChange: PropTypes.func.isRequired
};


class EditGroupPage extends Component {
  constructor(props) {
    super(props);

    this.state = props.initialData || {
        name: null,
        description: null,
        websiteUrl: null,
        imageUrl: null,
        headerUrl: null,
    };
  }
  componentDidMount() {
    $(window).on("beforeunload", function() {
      if (this.changed) {
        return "You have unsaved changes to your group.";
      }
    }.bind(this));
  }
  handleImageChange(e) {
    var MAX_IMAGE_MB = 2;
    var MAX_IMAGE_SIZE = MAX_IMAGE_MB * 1024 * 1024;
    var idToField = {
      groupHeader: "headerUrl",
      groupImage: "imageUrl",
    }
    var field = idToField[e.target.id];
    var file = e.currentTarget.files[0];
    if (file.size > MAX_IMAGE_SIZE) {
      alert("Images must be smaller than " + MAX_IMAGE_MB + "MB.");
      return;
    }
    var formData = new FormData();
    formData.append("file", e.currentTarget.files[0])
    $.ajax({
        url: '/api/file/upload',
        data: formData,
        type: 'POST',
        contentType: false,
        processData: false,
        success: function(data) {
          if ("error" in data) {
            alert(data.error);
            this.clearUploading(field);
          } else {
            var state = {};
            state[field] = data.url;
            this.setState(state);
            this.changed = true;
          }
        }.bind(this),
        fail: function() {
          alert("Unfortunately an error occurred uploading your file.")
          this.clearUploading(field);
        }
    });
    this.setUploading(field);
  }
  setUploading(field) {
    var state = {};
    state[field] = "/static/img/loading.gif";
    this.setState(state);
  }
  clearUploading(field) {
    var state = {};
    state[field] = null;
    this.setState(state);
  }
  handleInputChange(e) {
    var idToField = {
      groupName: "name",
      groupWebsite: "websiteUrl",
      groupDescription: "description"
    }
    var field = idToField[e.target.id];
    var state = {};
    state[field] = e.target.value;
    this.setState(state);
    this.changed = true;
  }
  delete() {
    if (confirm("Are you sure you want to delete this group? This cannot be undone.")) {
     $.ajax({
        url: "/api/groups/" + this.props.initialData.name,
        type: "DELETE",
        success: function(data) {
          if ("error" in data) {
            alert(data.error);
          } else {
            window.location = "/my/groups";
          }
        },
        fail: function() {
          alert("Sorry, an error occurred.");
        }
      });
    }
  }
  save() {
    var groupData = Sefaria.util.clone(this.state);
    if (!this.props.initialData) {
      groupData["new"] = true;
    }
    if (this.props.initialData && this.props.initialData.name !== groupData.name) {
      groupData["previousName"] = this.props.initialData.name;
    }
    if (groupData["headerUrl"] == "/static/img/loading.gif") { groupData["headerUrl"] = null; }
    if (groupData["imageUrl"] == "/static/img/loading.gif") { groupData["imageUrl"] = null; }

    $.post("/api/groups", {json: JSON.stringify(groupData)}, function(data) {
        if ("error" in data) {
          alert(data.error);
        } else {
          this.changed = false;
          window.location = "/groups/" + this.state.name.replace(/ /g, "-");
        }
    }.bind(this)).fail(function() {
        alert("Sorry, an error occurred.");
    });
  }
  render() {
    return (
      <div id="editGroupPage">
        {this.props.initialData
          ? <h1>
              <span className="int-en">Edit Group</span>
              <span className="int-he">ערוך קבוצה</span>
            </h1>
          : <h1>
              <span className="int-en">Create a Group</span>
              <span className="int-he">צור קבוצה</span>
            </h1>}

        <div id="saveCancelButtons">
            <a className="button transparent control-elem" href={this.props.initialData ? "/groups/" + this.state.name.replace(/ /g, "-") : "/my/groups"}>
                <span className="int-en">Cancel</span>
                <span className="int-he">בטל</span>
            </a>
            <div id="saveGroup" className="button blue control-elem" onClick={this.save}>
                <span className="int-en">Save</span>
                <span className="int-he">שמור</span>
            </div>
        </div>

        <div className="field halfWidth">
          <label>
            <span className="int-en">Group Name</span>
            <span className="int-he">שם הקבוצה</span>
          </label>
          <input id="groupName" value={this.state.name||""} onChange={this.handleInputChange}/>
        </div>

        <div className="field halfWidth">
          <label>
            <span className="int-en">Website</span>
            <span className="int-he">כתובת אתר</span>
          </label>
          <input id="groupWebsite" value={this.state.websiteUrl||""} onChange={this.handleInputChange}/>
        </div>

        <div className="field">
          <label>
            <span className="int-en">Description</span>
            <span className="int-he">תיאור</span>
          </label>
          <textarea id="groupDescription" onChange={this.handleInputChange} value={this.state.description||null}></textarea>
        </div>

        <div className="field">
          <label>
            <span className="int-en">Group Image</span>
            <span className="int-he">תמונה לקבוצה</span>
          </label>
          {this.state.imageUrl
            ? <img className="groupImage" src={this.state.imageUrl} alt="Group Image" />
            : <div className="groupImage placeholder"></div>}
          <FileInput
             name="groupImage"
             accept="image/*"
             text="Upload Image"
             className="button white"
             onChange={this.handleImageChange} />
          <div className="helperText">
            <span className="int-en">Recommended size: 350px x 350px or larger</span>
            <span className="int-he">גודל מומלץ: לפחות 350 פיקסל ע"ג 350 פיקסל</span>
          </div>
        </div>

        <div className="field">
          <label>
            <span className="int-en">Default Sheet Header</span>
            <span className="int-he">כותרת עמוד ראשונית</span>
          </label>
          {this.state.headerUrl
            ? <div className="groupHeaderBox">
                <img className="groupHeader" src={this.state.headerUrl} alt="Group Header Image" />
                <div className="clearFix"></div>
              </div>
            : <div className="groupHeader placeholder"></div>}
          <FileInput
             name="groupHeader"
             accept="image/*"
             text="Upload Image"
             className="button white"
             onChange={this.handleImageChange} />
          <div className="helperText">
            <span className="int-en">Recommended size: 1000px width to fill sheet, smaller images align right</span>
            <span className="int-he">גודל מומלץ: 1000 פיקסל כדי למלא את חלל הדף. גודל קטן יותר יתיישר לימין</span>
          </div>
        </div>

        {this.props.initialData ?
          <div className="deleteGroup" onClick={this.delete}>
            <span className="int-en">Delete Group</span>
            <span className="int-he">מחק קבוצה</span>
          </div>
          : null}

      </div>);
  }
}

EditGroupPage.propTypes = {
  initialData:  PropTypes.object // If present this view is for editing a group, otherwise for creating a new group
};



class FileInput extends Component {
  handleChange(e) {
    if (this.props.onChange) { this.props.onChange(e); }
  }
  render() {
    return (<div>
              <label htmlFor={this.props.name} className={this.props.className}>{this.props.text}</label>
              <input
                type="file"
                id={this.props.name}
                name={this.props.name}
                className="hiddenFileInput"
                accept={this.props.accept}
                onChange={this.handleChange} />
            </div>);
  }
}


class TagSheetsPage extends Component {
  // Page list all public sheets.
  componentDidMount() {
    this.ensureData();
  }
  getSheetsFromCache() {
    return  Sefaria.sheets.sheetsByTag(this.props.tag);
  }
  getSheetsFromAPI() {
     Sefaria.sheets.sheetsByTag(this.props.tag, this.onDataLoad);
  }
  onDataLoad(data) {
    this.forceUpdate();
  }
  ensureData() {
    if (!this.getSheetsFromCache()) { this.getSheetsFromAPI(); }
  }
  render() {
    var sheets = this.getSheetsFromCache();
    sheets = sheets ? sheets.map(function (sheet) {
      return (<PublicSheetListing sheet={sheet} key={sheet.id} />);
    }) : (<LoadingMessage />);
    return (<div className="content sheetList hasFooter">
                      <div className="contentInner">
                        {this.props.hideNavHeader ? (<h1>
                          <span className="int-en">{this.props.tag}</span>
                          <span className="int-he">{this.props.tag}</span>
                        </h1>) : null}
                        {sheets}
                      </div>
                      <footer id="footer" className="static sans">
                        <Footer />
                      </footer>
                    </div>);
  }
}

TagSheetsPage.propTypes = {
  hideNavHeader:   PropTypes.bool
};


class AllSheetsPage extends Component {
  // Page list all public sheets.
  // TODO this is currently loading all public sheets at once, needs pagination
  constructor(props) {
    super(props);

    this.state = {
      page: 1,
      loadedToEnd: false,
      loading: false,
      curSheets: [],
    };
  }
  componentDidMount() {
    $(ReactDOM.findDOMNode(this)).bind("scroll", this.handleScroll);
    this.ensureData();
  }
  handleScroll() {
    if (this.state.loadedToEnd || this.state.loading) { return; }
    var $scrollable = $(ReactDOM.findDOMNode(this));
    var margin = 100;
    if($scrollable.scrollTop() + $scrollable.innerHeight() + margin >= $scrollable[0].scrollHeight) {
      this.getMoreSheets();
    }
  }
  getMoreSheets() {
    if (this.state.page == 1) {
      Sefaria.sheets.publicSheets(0,100,this.loadMoreSheets);
    }
    else {
      Sefaria.sheets.publicSheets( ((this.state.page)*50),50,this.loadMoreSheets);
    }
    this.setState({loading: true});
  }
  loadMoreSheets(data) {
    this.setState({page: this.state.page + 1});
    this.createSheetList(data)
  }
  createSheetList(newSheets) {

      if (newSheets) {
        this.setState({curSheets: this.state.curSheets.concat(newSheets), loading: false});
      }
  }
  getSheetsFromCache(offset) {
    if (!offset) offset=0;
    return  Sefaria.sheets.publicSheets(offset,50);
  }
  getSheetsFromAPI(offset) {
    if (!offset) offset=0;
     Sefaria.sheets.publicSheets(offset,50, this.onDataLoad);
  }
  onDataLoad(data) {
    this.forceUpdate();
  }
  ensureData() {
    if (!this.getSheetsFromCache()) { this.getSheetsFromAPI(); }
  }
  render() {
    if (this.state.page == 1) {
      var sheets = this.getSheetsFromCache();
    }
    else {
      var sheets = this.state.curSheets;
    }
    sheets = sheets ? sheets.map(function (sheet) {
      return (<PublicSheetListing sheet={sheet} />);
    }) : (<LoadingMessage />);
    return (<div className="content sheetList hasFooter">
                      <div className="contentInner">
                        {this.props.hideNavHeader ? (<h1>
                          <span className="int-en">All Sheets</span>
                          <span className="int-he">כל דפי המקורות</span>
                        </h1>) : null}
                        {sheets}
                      </div>
                      <footer id="footer" className="static sans">
                        <Footer />
                      </footer>
                    </div>);
  }
}

AllSheetsPage.propTypes = {
  hideNavHeader:   PropTypes.bool
};


class PublicSheetListing extends Component {
  render() {
    var sheet = this.props.sheet;
    var title = sheet.title ? sheet.title.stripHtml() : "Untitled Source Sheet";
    var url = "/sheets/" + sheet.id;
    return (<a className="sheet" href={url} key={url}>
              {sheet.ownerImageUrl ? (<img className="sheetImg" src={sheet.ownerImageUrl} alt={sheet.ownerName}/>) : null}
              <span className="sheetViews"><i className="fa fa-eye"></i> {sheet.views}</span>
              <div className="sheetAuthor">{sheet.ownerName}</div>
              <div className="sheetTitle">{title}</div>
            </a>);
  }
}

PublicSheetListing.propTypes = {
  sheet: PropTypes.object.isRequired
};


class SheetTagButton extends Component {
  handleTagClick(e) {
    e.preventDefault();
    this.props.setSheetTag(this.props.tag);
  }
  render() {
    return (<a href={`/sheets/tags/${this.props.tag}`} className="navButton" onClick={this.handleTagClick}>{this.props.tag} (<span className="enInHe">{this.props.count}</span>)</a>);
  }
}

SheetTagButton.propTypes = {
  tag:   PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  setSheetTag: PropTypes.func.isRequired
};


class MySheetsPage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      showYourSheetTags: false,
      sheetFilterTag: null
    };
  }
  componentDidMount() {
    this.ensureData();
  }
  getSheetsFromCache() {
    return  Sefaria.sheets.userSheets(Sefaria._uid, null, this.props.mySheetSort);
  }
  getSheetsFromAPI() {
     Sefaria.sheets.userSheets(Sefaria._uid, this.onDataLoad, this.props.mySheetSort);
  }
  getTagsFromCache() {
    return Sefaria.sheets.userTagList(Sefaria._uid)
  }
  getTagsFromAPI() {
    Sefaria.sheets.userSheets(Sefaria._uid, this.onDataLoad);
  }
  onDataLoad(data) {
    this.forceUpdate();
  }
  ensureData() {
    if (!this.getSheetsFromCache()) { this.getSheetsFromAPI(); }
    if (!this.getTagsFromCache())   { this.getTagsFromAPI(); }
  }
  toggleSheetTags() {
    this.state.showYourSheetTags ? this.setState({showYourSheetTags: false}) : this.setState({showYourSheetTags: true});
  }
  filterYourSheetsByTag (tag) {
    if (tag.tag == this.state.sheetFilterTag) {
       this.setState({sheetFilterTag: null, showYourSheetTags: false});
    } else {
      this.setState({sheetFilterTag: tag.tag, showYourSheetTags: false});
    }
  }
  changeSortYourSheets(event) {
    this.props.setMySheetSort(event.target.value);
    Sefaria.sheets.userSheets(Sefaria._uid, this.onDataLoad, event.target.value);
  }
  render() {
    var sheets = this.getSheetsFromCache();
    sheets = sheets && this.state.sheetFilterTag ? sheets.filter(function(sheet) {
      return Sefaria.util.inArray(this.state.sheetFilterTag, sheet.tags) >= 0;
    }.bind(this)) : sheets;
    sheets = sheets ? sheets.map(function(sheet) {
      return (<PrivateSheetListing sheet={sheet} setSheetTag={this.props.setSheetTag} key={sheet.id} />);
    }.bind(this)) : (<LoadingMessage />);

    var userTagList = this.getTagsFromCache();
    userTagList = userTagList ? userTagList.map(function (tag) {
      var filterThisTag = this.filterYourSheetsByTag.bind(this, tag);
      var classes = classNames({navButton: 1, sheetButton: 1, active: this.state.sheetFilterTag == tag.tag});
      return (<div className={classes} onClick={filterThisTag} key={tag.tag}>{tag.tag} ({tag.count})</div>);
    }.bind(this)) : null;

    return (<div className="content sheetList">
              <div className="contentInner">
                {this.props.hideNavHeader ?
                  (<h1>
                    <span className="int-en">My Source Sheets</span>
                    <span className="int-he">דפי המקורות שלי</span>
                  </h1>) : null}
                {this.props.hideNavHeader ?
                  (<div className="sheetsNewButton">
                    <a className="button white" href="/sheets/new">
                        <span className="int-en">Create a Source Sheet</span>
                        <span className="int-he">צור דף מקורות חדש</span>
                    </a>
                  </div>) : null }

                {this.props.hideNavHeader ?
                 (<h2 className="splitHeader">
                    <span className="int-en" onClick={this.toggleSheetTags}>Filter By Tag <i className="fa fa-angle-down"></i></span>
                    <span className="int-he" onClick={this.toggleSheetTags}>סנן לפי תווית<i className="fa fa-angle-down"></i></span>
                    <span className="int-en actionText">Sort By:
                      <select value={this.props.mySheetSort} onChange={this.changeSortYourSheets}>
                       <option value="date">Recent</option>
                       <option value="views">Most Viewed</option>
                     </select> <i className="fa fa-angle-down"></i></span>
                    <span className="int-he actionText">סנן לפי:
                      <select value={this.props.mySheetSort} onChange={this.changeSortYourSheets}>
                       <option value="date">הכי חדש</option>
                       <option value="views">הכי נצפה</option>
                     </select> <i className="fa fa-angle-down"></i></span>

                  </h2>) : null }
                {this.state.showYourSheetTags ? <TwoOrThreeBox content={userTagList} width={this.props.width} /> : null}
                {sheets}
              </div>
            </div>);
  }
}

MySheetsPage.propTypes = {
  setSheetTag:     PropTypes.func.isRequired,
  setSheetTagSort: PropTypes.func.isRequired,
  multiPanel:      PropTypes.bool,
  hideNavHeader:   PropTypes.bool

};


class PrivateSheetListing extends Component {
  render() {
    var sheet = this.props.sheet;
    var title = sheet.title ? sheet.title.stripHtml() : "Untitled Source Sheet";
    var url = "/sheets/" + sheet.id;

    if (sheet.tags === undefined) sheet.tags = [];
      var tagString = sheet.tags.map(function (tag) {
          return(<SheetTagLink setSheetTag={this.props.setSheetTag} tag={tag} key={tag} />);
    }, this);

   return (<div className="sheet userSheet" href={url} key={url}>
              <a className="sheetTitle" href={url}>{title}</a>  <SheetAccessIcon sheet={sheet} />
              <div>{sheet.views} Views · {sheet.modified} · <span className="tagString">{tagString}</span></div>
          </div>);
  }
}

PrivateSheetListing.propTypes = {
  sheet:       PropTypes.object.isRequired,
  setSheetTag: PropTypes.func.isRequired
};


class SheetAccessIcon extends Component {
  render() {
    var sheet = this.props.sheet;
    var msg = "group" in sheet ? "Listed for Group members only" : "Private";
    return (sheet.status == "unlisted") ?
      (<i className="fa fa-lock" title={msg}></i>)
      : null;
  }
}

SheetAccessIcon.propTypes = {
  sheet: PropTypes.object.isRequired
};


class SheetTagLink extends Component {
  handleTagClick(e) {
    e.preventDefault();
    this.props.setSheetTag(this.props.tag);
  }
  render() {
    return (<a href={`/sheets/tags/${this.props.tag}`} onClick={this.handleTagClick}>{this.props.tag}</a>);
  }
}

SheetTagLink.propTypes = {
  tag:   PropTypes.string.isRequired,
  setSheetTag: PropTypes.func.isRequired
};


class ToggleSet extends Component {
  // A set of options grouped together.
  render() {
    var classes = {toggleSet: 1, separated: this.props.separated };
    classes[this.props.name] = 1;
    classes = classNames(classes);
    var value = this.props.name === "layout" ? this.props.currentLayout() : this.props.settings[this.props.name];
    var width = 100.0 - (this.props.separated ? (this.props.options.length - 1) * 3 : 0);
    var style = {width: (width/this.props.options.length) + "%", outline: "none"};
    return (
      <div className={classes} role={this.props.role} aria-label={this.props.ariaLabel}>
        {
          this.props.options.map(function(option) {
            return (
              <ToggleOption
                name={option.name}
                key={option.name}
                set={this.props.name}
                role={option.role}
                ariaLable={option.ariaLabel}
                on={value == option.name}
                setOption={this.props.setOption}
                style={style}
                image={option.image}
                fa={option.fa}
                content={option.content} />);
          }.bind(this))
        }
      </div>);
  }
}

ToggleSet.propTypes = {
  name:          PropTypes.string.isRequired,
  setOption:     PropTypes.func.isRequired,
  currentLayout: PropTypes.func,
  settings:      PropTypes.object.isRequired,
  options:       PropTypes.array.isRequired,
  separated:     PropTypes.bool,
  role:          PropTypes.string,
  ariaLabel:     PropTypes.string
};


class ToggleOption extends Component {
  // A single option in a ToggleSet

  handleClick() {
    this.props.setOption(this.props.set, this.props.name);
    if (Sefaria.site) { Sefaria.site.track.event("Reader", "Display Option Click", this.props.set + " - " + this.props.name); }
  }
  render() {
    var classes = {toggleOption: 1, on: this.props.on };
    var tabIndexValue = this.props.on ? 0 : -1;
    var ariaCheckedValue = this.props.on ? "true" : "false";
    classes[this.props.name] = 1;
    classes = classNames(classes);
    var content = this.props.image ? (<img src={this.props.image} alt=""/>) :
                    this.props.fa ? (<i className={"fa fa-" + this.props.fa}></i>) :
                      (<span dangerouslySetInnerHTML={ {__html: this.props.content} }></span>);
    return (
      <div
        role={this.props.role}
        aria-label= {this.props.ariaLabel}
        tabIndex = {this.props.role == "radio"? tabIndexValue : "0"}
        aria-value = {ariaCheckedValue}
        className={classes}
        style={this.props.style}
        onClick={this.handleClick}>
        {content}
      </div>);
  }
}


class ReaderNavigationMenuSearchButton extends Component {
  render() {
    return (<span className="readerNavMenuSearchButton" onClick={this.props.onClick}><i className="fa fa-search"></i></span>);
  }
}


class ReaderNavigationMenuMenuButton extends Component {
  render() {
    var icon = this.props.compare ? (<i className="fa fa-chevron-left"></i>) : (<i className="fa fa-bars"></i>);
    return (<span className="readerNavMenuMenuButton" onClick={this.props.onClick}>{icon}</span>);
  }
}


class ReaderNavigationMenuCloseButton extends Component {
  onClick(e) {
    e.preventDefault();
    this.props.onClick();
  }
  render() {
    if (this.props.icon == "circledX"){
      var icon = <img src="/static/img/circled-x.svg" />;
    } else if (this.props.icon == "chevron") {
      var icon = <i className="fa fa-chevron-left"></i>
    } else {
      var icon = "×";
    }
    var classes = classNames({readerNavMenuCloseButton: 1, circledX: this.props.icon === "circledX"});
    var url = this.props.url || "";
    return (<a href={url} className={classes} onClick={this.onClick}>{icon}</a>);
  }
}


class ReaderNavigationMenuDisplaySettingsButton extends Component {
  render() {
    return (<a
              href="#"
              className="readerOptions"
              role="button"
              aria-haspopup="true"
              onClick={this.props.onClick}
              onKeyPress={function(e) {e.charCode == 13 ? this.props.onClick(e):null}.bind(this)}>
                <img src="/static/img/ayealeph.svg" alt="Toggle Reader Menu Display Settings"/>
            </a>);
  }
}


class CategoryColorLine extends Component {
  render() {
    var style = {backgroundColor: Sefaria.palette.categoryColor(this.props.category)};
    return (<div className="categoryColorLine" style={style}></div>);
  }
}


class TextColumn extends Component {
  // An infinitely scrollable column of text, composed of TextRanges for each section.
  componentDidMount() {
    this._isMounted = true;
    this.$container = $(ReactDOM.findDOMNode(this));
    this.initialScrollTopSet = false;
    this.justTransitioned    = true;
    this.setScrollPosition();
    this.adjustInfiniteScroll();
    this.setPaddingForScrollbar();
    this.debouncedAdjustTextListHighlight = Sefaria.util.debounce(this.adjustTextListHighlight, 100);
    var node = ReactDOM.findDOMNode(this);
    node.addEventListener("scroll", this.handleScroll);
  }
  componentWillUnmount() {
    this._isMounted = false;
    var node = ReactDOM.findDOMNode(this);
    node.removeEventListener("scroll", this.handleScroll);
  }
  componentWillReceiveProps(nextProps) {
    if (this.props.mode === "Text" && nextProps.mode === "TextAndConnections") {
      // When moving into text and connections, scroll to highlighted
      this.justTransitioned    = true;
      this.scrolledToHighlight = false;
      this.initialScrollTopSet = true;

    } else if (this.props.mode === "TextAndConnections" && nextProps.mode === "TextAndConnections") {
      // Don't mess with scroll position within Text and Connections mode
      if (this.justTransitioned) {
        this.justTransitioned = false;
      } else if (!this.initialScrollTopSet) {
        this.scrolledToHighlight = true;

      }
    } else if (this.props.mode === "TextAndConnections" && nextProps.mode === "Text") {
      // Don't mess with scroll position within Text and Connections mode
      this.scrolledToHighlight = true;
      this.initialScrollTopSet = true;

    } else if (this.props.panelsOpen !== nextProps.panelsOpen) {
      this.scrolledToHighlight = false;
    } else if (nextProps.srefs.length == 1 && Sefaria.util.inArray(nextProps.srefs[0], this.props.srefs) == -1) {
      // If we are switching to a single ref not in the current TextColumn, treat it as a fresh open.
      this.initialScrollTopSet = false;
      this.scrolledToHighlight = false;
      this.loadingContentAtTop = false;
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (!this.props.highlightedRefs.compare(prevProps.highlightedRefs)) {
      //console.log("Scroll for highlight change")
      this.setScrollPosition();  // highlight change
    }
    if (this.props.layoutWidth !== prevProps.layoutWidth ||
        this.props.settings.language !== prevProps.settings.language) {
      //console.log("scroll to highlighted on layout change")
      this.scrollToHighlighted();
    }
  }
  handleScroll(event) {
    //console.log("scroll");
    if (this.justScrolled) {
      //console.log("pass scroll");
      this.justScrolled = false;
      return;
    }
    if (this.props.highlightedRefs.length) {
      //console.log("Calling debouncedAdjustTextListHighlight");
      this.debouncedAdjustTextListHighlight();
    }
    this.adjustInfiniteScroll();
  }
  handleTextSelection() {
    var selection = window.getSelection();

    if (selection.type === "Range") {
      var $start    = $(Sefaria.util.getSelectionBoundaryElement(true)).closest(".segment");
      var $end      = $(Sefaria.util.getSelectionBoundaryElement(false)).closest(".segment");
      var $segments = $start.is($end) ? $start : $start.nextUntil($end, ".segment").add($start).add($end);
      var refs      = [];

      $segments.each(function() {
        refs.push($(this).attr("data-ref"));
      });

      //console.log("Setting highlights by Text Selection");
      this.props.setTextListHighlight(refs);
    }

    this.props.setSelectedWords(selection.toString());
  }
  handleTextLoad() {
    if (this.loadingContentAtTop || !this.initialScrollTopSet) {
      //console.log("text load, setting scroll");
      this.setScrollPosition();
    } else if (!this.scrolledToHighlight && $(ReactDOM.findDOMNode(this)).find(".segment.highlight").length) {
      //console.log("scroll to highlighted")
      this.scrollToHighlighted();
      this.scrolledToHighlight = true;
      this.initialScrollTopSet = true;
    }

    this.adjustInfiniteScroll();
  }
  setScrollPosition() {
    // console.log("ssp");
    // Called on every update, checking flags on `this` to see if scroll position needs to be set
    if (this.loadingContentAtTop) {
      // After adding content by infinite scrolling up, scroll back to what the user was just seeing
      //console.log("loading at top");
      var $node   = this.$container;
      var adjust  = 118; // Height of .loadingMessage.base
      var $texts  = $node.find(".basetext");
      if ($texts.length < 2) { return; }
      var top     = $texts.eq(1).position().top + $node.scrollTop() - adjust;
      if (!$texts.eq(0).hasClass("loading")) {
        this.loadingContentAtTop = false;
        this.initialScrollTopSet = true;
        this.justScrolled = true;
        ReactDOM.findDOMNode(this).scrollTop = top;
        this.scrollToHighlighted();
       // console.log(top)
      }
    } else if (!this.scrolledToHighlight && $(ReactDOM.findDOMNode(this)).find(".segment.highlight").length) {
      //console.log("scroll to highlighted");
      // scroll to highlighted segment
      this.scrollToHighlighted();
      this.scrolledToHighlight = true;
      this.initialScrollTopSet = true;
      this.justScrolled        = true;
    } else if (!this.initialScrollTopSet) {
      //console.log("initial scroll to 30");
      // initial value set below 0 so you can scroll up for previous
      var node = ReactDOM.findDOMNode(this);
      node.scrollTop = 30;
      this.initialScrollTopSet = true;
    }
    // This fixes loading of next content when current content is short in viewport,
    // but breaks loading highlighted ref, jumping back up to top of section
    // this.adjustInfiniteScroll();
  }
  adjustInfiniteScroll() {
    // Add or remove TextRanges from the top or bottom, depending on scroll position
    // console.log("adjust Infinite Scroll");
    if (!this._isMounted) { return; }
    var node         = ReactDOM.findDOMNode(this);
    var $node        = $(node);

    var refs         = this.props.srefs;
    var $lastText    = $node.find(".textRange.basetext").last();
    if (!$lastText.length) { console.log("no last basetext"); return; }
    var lastTop      = $lastText.position().top;
    var lastBottom   = lastTop + $lastText.outerHeight();
    var windowHeight = $node.outerHeight();
    var windowTop    = node.scrollTop;
    var windowBottom = windowTop + windowHeight;
    if (lastTop > (windowHeight + 100) && refs.length > 1) {
      // Remove a section scrolled out of view on bottom
      refs = refs.slice(0,-1);
      this.props.updateTextColumn(refs);
    } else if (windowTop < 21 && !this.loadingContentAtTop) {
      // UP: add the previous section above then adjust scroll position so page doesn't jump
      var topRef = refs[0];
      var data   = Sefaria.ref(topRef);
      if (data && data.prev) {
        //console.log("Up! Add previous section");
        refs.splice(refs, 0, data.prev);
        this.loadingContentAtTop = true;
        this.props.updateTextColumn(refs);
        if (Sefaria.site) { Sefaria.site.track.event("Reader", "Infinite Scroll", "Up"); }
      }
    } else if ( lastBottom < windowHeight + 80 ) {
      // DOWN: add the next section to bottom
      if ($lastText.hasClass("loading")) {
        // console.log("last text is loading - don't add next section");
        return;
      }
      //console.log("Down! Add next section");
      var currentRef = refs.slice(-1)[0];
      var data       = Sefaria.ref(currentRef);
      if (data && data.next) {
        refs.push(data.next);
        this.props.updateTextColumn(refs);
        if (Sefaria.site) { Sefaria.site.track.event("Reader", "Infinite Scroll", "Down"); }
      }
    }  else {
      // nothing happens
    }
  }
  getHighlightThreshhold() {
    // Returns the distance from the top of screen that we want highlighted segments to appear below.
    return this.props.multiPanel ? 200 : 50;
  }
  adjustTextListHighlight() {
    // console.log("adjustTextListHighlight");
    // When scrolling while the TextList is open, update which segment should be highlighted.
    if (this.props.multiPanel && this.props.layoutWidth == 100) {
      return; // Hacky - don't move around highlighted segment when scrolling a single panel,
    }
    // but we do want to keep the highlightedRefs value in the panel
    // so it will return to the right location after closing other panels.
    if (!this._isMounted) { return; }
    var $container   = this.$container;
    var threshhold   = this.getHighlightThreshhold();
    $container.find(".basetext .segment").each(function(i, segment) {
      var $segment = $(segment);
      if ($segment.offset().top > threshhold) {
        var ref = $segment.attr("data-ref");
        this.props.setTextListHighlight(ref);
        return false;
      }
    }.bind(this));
  }
  scrollToHighlighted() {
    window.requestAnimationFrame(function() {
      if (!this._isMounted) { return; }
      //console.log("scroll to highlighted - animation frame");
      var $container   = this.$container;
      var $readerPanel = $container.closest(".readerPanel");
      var $highlighted = $container.find(".segment.highlight").first();
      if ($highlighted.length) {
        this.justScrolled = true;
        var offset = this.getHighlightThreshhold();
        $container.scrollTo($highlighted, 0, {offset: -offset});
      }
    }.bind(this));
  }
  setPaddingForScrollbar() {
    // Scrollbars take up spacing, causing the centering of TextColumn to be slightly off center
    // compared to the header. This functions sets appropriate padding to compensate.
    var width      = Sefaria.util.getScrollbarWidth();
    if (this.props.interfaceLang == "hebrew") {
      this.$container.css({paddingRight: width, paddingLeft: 0});
    } else {
      this.$container.css({paddingRight: 0, paddingLeft: width});
    }
  }
  render() {
    var classes = classNames({textColumn: 1, connectionsOpen: this.props.mode === "TextAndConnections"});
    var content =  this.props.srefs.map(function(ref, k) {
      return (<TextRange
        sref={ref}
        version={this.props.version}
        versionLanguage={this.props.versionLanguage}
        highlightedRefs={this.props.highlightedRefs}
        basetext={true}
        withContext={true}
        loadLinks={true}
        prefetchNextPrev={true}
        settings={this.props.settings}
        setOption={this.props.setOption}
        showBaseText={this.props.showBaseText}
        onSegmentClick={this.props.onSegmentClick}
        onCitationClick={this.props.onCitationClick}
        onTextLoad={this.handleTextLoad.bind(this)}
        filter={this.props.filter}
        panelsOpen={this.props.panelsOpen}
        layoutWidth={this.props.layoutWidth}
        key={k + ref} />);
    }.bind(this));

    if (content.length) {
      // Add Next and Previous loading indicators
      var first   = Sefaria.ref(this.props.srefs[0]);
      var last    = Sefaria.ref(this.props.srefs.slice(-1)[0]);
      var hasPrev = first && first.prev;
      var hasNext = last && last.next;
      var topSymbol  = " ";
      var bottomSymbol = " ";
      if (hasPrev && INBROWSER) {
        content.splice(0, 0, (<LoadingMessage className="base prev" key="prev"/>));
      } else {
        content.splice(0, 0, (<LoadingMessage message={topSymbol} heMessage={topSymbol} className="base prev" key="prev"/>));
      }
      if (hasNext) {
        content.push((<LoadingMessage className="base next" key="next"/>));
      } else {
        content.push((<LoadingMessage message={bottomSymbol} heMessage={bottomSymbol} className="base next final" key="next"/>));
      }
    }

    return (<div className={classes} onMouseUp={this.handleTextSelection}>{content}</div>);
  }
}

TextColumn.propTypes = {
  srefs:                 PropTypes.array.isRequired,
  version:               PropTypes.string,
  versionLanguage:       PropTypes.string,
  highlightedRefs:       PropTypes.array,
  basetext:              PropTypes.bool,
  withContext:           PropTypes.bool,
  loadLinks:             PropTypes.bool,
  prefetchNextPrev:      PropTypes.bool,
  openOnClick:           PropTypes.bool,
  lowlight:              PropTypes.bool,
  multiPanel:            PropTypes.bool,
  mode:                  PropTypes.string,
  settings:              PropTypes.object,
  interfaceLang:         PropTypes.string,
  showBaseText:          PropTypes.func,
  updateTextColumn:      PropTypes.func,
  onSegmentClick:        PropTypes.func,
  onCitationClick:       PropTypes.func,
  setTextListHighlight:  PropTypes.func,
  setSelectedWords:      PropTypes.func,
  onTextLoad:            PropTypes.func,
  panelsOpen:            PropTypes.number,
  layoutWidth:           PropTypes.number
};


class TextRange extends Component {
  // A Range or text defined a by a single Ref. Specially treated when set as 'basetext'.
  // This component is responsible for retrieving data from `Sefaria` for the ref that defines it.
componentDidMount() {
    this._isMounted = true;
    var data = this.getText();
    if (data && !this.dataPrefetched) {
      // If data was populated server side, onTextLoad was never called
      this.onTextLoad(data);
    } else if (this.props.basetext || this.props.segmentNumber) {
      this.placeSegmentNumbers();
    }
    window.addEventListener('resize', this.handleResize);
  }
  componentWillUnmount() {
    this._isMounted = false;
    window.removeEventListener('resize', this.handleResize);
  }
  componentDidUpdate(prevProps, prevState) {
    // Place segment numbers again if update affected layout
    if (this.props.basetext || this.props.segmentNumber) {
      if (this.props.version != prevProps.version ||
          this.props.versionLanguage != prevProps.versionLanguage ||
          prevProps.settings.language !== this.props.settings.language ||
          prevProps.settings.layoutDefault !== this.props.settings.layoutDefault ||
          prevProps.settings.layoutTanakh !== this.props.settings.layoutTanakh ||
          prevProps.settings.layoutTalmud !== this.props.settings.layoutTalmud ||
          prevProps.settings.biLayout !== this.props.settings.biLayout ||
          prevProps.settings.fontSize !== this.props.settings.fontSize ||
          prevProps.layoutWidth !== this.props.layoutWidth ||
          prevProps.filter !== this.props.filter) {
            // Rerender in case version has changed
            this.forceUpdate(function() {
                this.placeSegmentNumbers();
            }.bind(this));
      }
    }
  }
  handleResize() {
    if (this.props.basetext || this.props.segmentNumber) {
      this.placeSegmentNumbers();
    }
  }
  handleClick(event) {
    if (window.getSelection().type === "Range") {
      // Don't do anything if this click is part of a selection
      return;
    }
    if (this.props.onRangeClick) {
      //Click on the body of the TextRange itself from TextList
      this.props.onRangeClick(this.props.sref);
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Click Text from TextList", this.props.sref); }
    }
  }
  getText() {
    var settings = {
      context: this.props.withContext ? 1 : 0,
      version: this.props.version || null,
      language: this.props.versionLanguage || null
    };
    var data = Sefaria.text(this.props.sref, settings);

    if (!data || "updateFromAPI" in data) { // If we don't have data yet, call again with a callback to trigger API call
      Sefaria.text(this.props.sref, settings, this.onTextLoad);
    }
    return data;
  }
  onTextLoad(data) {
    // Initiate additional API calls when text data first loads
    if (this.props.basetext && this.props.sref !== data.ref) {
      // Replace ReaderPanel contents ref with the normalized form of the ref, if they differ.
      // Pass parameter to showBaseText to replaceHistory - normalization should't add a step to history
      this.props.showBaseText(data.ref, true, this.props.version, this.props.versionLanguage);
      return;
    }

    // If this is a ref to a super-section, rewrite it to first available section
    if (data.textDepth - data.sections.length > 1 && data.firstAvailableSectionRef) {
      this.props.showBaseText(data.firstAvailableSectionRef, true, this.props.version, this.props.versionLanguage);
      return;
    }

    this.prefetchData();

    if (this.props.onTextLoad) {
      this.props.onTextLoad();
    }

    if (this._isMounted) {
      this.forceUpdate(function() {
        this.placeSegmentNumbers();
      }.bind(this));
    }
  }
  prefetchData() {
    // Prefetch additional data (next, prev, links, notes etc) for this ref
    if (this.dataPrefetched) { return; }

    var data = this.getText();
    if (!data) { return; }

    // Load links at section level if spanning, so that cache is properly primed with section level refs
    var sectionRefs = data.isSpanning ? data.spanningRefs : [data.sectionRef];
    sectionRefs = sectionRefs.map(function(ref) {
      if (ref.indexOf("-") > -1) {
        ref = ref.split("-")[0];
        ref = ref.slice(0, ref.lastIndexOf(":"));
      }
      return ref;
    });

    if (this.props.loadLinks && !Sefaria.linksLoaded(sectionRefs)) {
      for (var i = 0; i < sectionRefs.length; i++) {
        Sefaria.related(sectionRefs[i], function() {
          if (this._isMounted) { this.forceUpdate(); }
        }.bind(this));
        if (Sefaria._uid) {
          Sefaria.relatedPrivate(sectionRefs[i], function() {
            if (this._isMounted) { this.forceUpdate(); }
          }.bind(this));
        }
      }
    }

    if (this.props.prefetchNextPrev) {
     if (data.next) {
       Sefaria.text(data.next, {
         context: 1,
         version: this.props.version || null,
         language: this.props.versionLanguage || null
       }, function() {});
     }
     if (data.prev) {
       Sefaria.text(data.prev, {
         context: 1,
         version: this.props.version || null,
         language: this.props.versionLanguage || null
       }, function() {});
     }
     if (data.indexTitle) {
        // Preload data that is used on Text TOC page
        Sefaria.indexDetails(data.indexTitle, function() {});
     }
    }
    this.dataPrefetched = true;
  }
  placeSegmentNumbers() {
    //console.log("placeSegmentNumbers", this.props.sref);
    //debugger
    //console.trace();
    // Set the vertical offsets for segment numbers and link counts, which are dependent
    // on the rendered height of the text of each segment.
    var $text  = $(ReactDOM.findDOMNode(this));
    var elemsAtPosition = {}; // Keyed by top position, an array of elements found there
    var setTop = function() {
      var $elem = $(this);
      var top   = $elem.parent().position().top;
      $elem.css({top: top});
      var list = elemsAtPosition[top] || [];
      list.push($elem);
      elemsAtPosition[top] = list;
    };
    $text.find(".linkCount").each(setTop);
    elemsAtPosition = {};  // resetting because we only want it to track segmentNumbers
    $text.find(".segmentNumber").each(setTop).show();
    var fixCollision = function ($elems) {
      // Takes an array of jQuery elements that all currently appear at the same top position
      if ($elems.length == 1) { return; }
      if ($elems.length == 2) {
        var adjust = 8;
        $elems[0].css({top: "-=" + adjust});
        $elems[1].css({top: "+=" + adjust});
      }
      /* Sketching a general solution for any number of elements, incomplete.
      var halfOrLess = Math.floor($elems.length / 2);
      var above = $elems.slice(0, halfOrLess);
      var below = $elems.slice(-halfOrLess);
      for (var i = 0; i < halfOrLess; i++) {

      }
      */
    };
    for (var top in elemsAtPosition) {
      if (elemsAtPosition.hasOwnProperty(top)) {
        fixCollision(elemsAtPosition[top]);
      }
    }
    $text.find(".segmentNumber").show();
    $text.find(".linkCount").show();
  }
  onFootnoteClick(event) {
    $(event.target).closest("sup").next("i.footnote").toggle();
    this.placeSegmentNumbers();
  }
  render() {
    var data = this.getText();
    if (data && this.props.basetext) {
      var ref              = this.props.withContext ? data.sectionRef : data.ref;
      var sectionStrings   = Sefaria.sectionString(ref);
      var oref             = Sefaria.ref(ref);
      var useShortString   = oref && Sefaria.util.inArray(oref.primary_category, ["Tanakh", "Mishnah", "Talmud", "Tanaitic", "Commentary"]) !== -1;
      var title            = useShortString ? sectionStrings.en.numbered : sectionStrings.en.named;
      var heTitle          = useShortString ? sectionStrings.he.numbered : sectionStrings.he.named;
    } else if (data && !this.props.basetext) {
      var title            = data.ref;
      var heTitle          = data.heRef;
    } else if (!data) {
      var title            = "Loading...";
      var heTitle          = "טעינה...";
    }
    var showNumberLabel    =  data &&
                              data.categories &&
                              data.categories[0] !== "Talmud" &&
                              data.categories[0] !== "Liturgy";

    var showSegmentNumbers = showNumberLabel && this.props.basetext;

    var segments = Sefaria.makeSegments(data, this.props.withContext);
    var textSegments = segments.map(function (segment, i) {
      var highlight = this.props.highlightedRefs && this.props.highlightedRefs.length ?                                  // if highlighted refs are explicitly set
                        Sefaria.util.inArray(segment.ref, this.props.highlightedRefs) !== -1 : // highlight if this ref is in highlighted refs prop
                        this.props.basetext && segment.highlight;                   // otherwise highlight if this a basetext and the ref is specific
      return (
        <TextSegment
            sref={segment.ref}
            en={segment.en}
            he={segment.he}
            highlight={highlight}
            segmentNumber={showSegmentNumbers ? segment.number : 0}
            showLinkCount={this.props.basetext}
            filter={this.props.filter}
            onSegmentClick={this.props.onSegmentClick}
            onCitationClick={this.props.onCitationClick}
            onFootnoteClick={this.onFootnoteClick}
            key={i + segment.ref} />
      );
    }.bind(this));
    textSegments = textSegments.length ? textSegments : null;

    var classes = {
                    textRange: 1,
                    basetext: this.props.basetext,
                    loading: !data,
                    lowlight: this.props.lowlight
                  };
    classes = classNames(classes);

    var open        = function() { this.props.onNavigationClick(this.props.sref)}.bind(this);
    var compare     = function() { this.props.onCompareClick(this.props.sref)}.bind(this);
    var connections = function() { this.props.onOpenConnectionsClick([this.props.sref])}.bind(this);

    var actionLinks = (<div className="actionLinks">
                        <span className="openLink" onClick={open}>
                          <img src="/static/img/open-64.png" alt="" />
                          <span className="en">Open</span>
                          <span className="he">פתח</span>
                        </span>
                        <span className="compareLink" onClick={compare}>
                          <img src="/static/img/compare-64.png" alt="" />
                          <span className="en">Compare</span>
                          <span className="he">השווה</span>
                        </span>
                        <span className="connectionsLink" onClick={connections}>
                          <i className="fa fa-link"></i>
                          <span className="en">Connections</span>
                          <span className="he">קשרים</span>
                        </span>
                      </div>);

    // configure number display for inline references
    var sidebarNumberDisplay = (this.props.inlineReference &&
    this.props.inlineReference['data-commentator'] === Sefaria.index(Sefaria.parseRef(this.props.sref).index).collectiveTitle);
    if (sidebarNumberDisplay) {
      if (this.props.inlineReference['data-label']) {
        var displayValue = this.props.inlineReference['data-label'];
      }
      else {
        var displayValue = Sefaria.hebrew.encodeHebrewNumeral(this.props.inlineReference['data-order']);
      }
      if (displayValue === undefined) {
        displayValue = this.props.inlineReference['data-order'];
      }
      var sidebarNum = <div className="numberLabel sans itag">
        <span className="numberLabelInner">
          <span className="he heOnly">{displayValue}</span>
        </span>
      </div>;
    } else if (showNumberLabel && this.props.numberLabel) {
      var sidebarNum = <div className="numberLabel sans">
        <span className="numberLabelInner">
          <span className="en">{this.props.numberLabel}</span>
          <span className="he">{Sefaria.hebrew.encodeHebrewNumeral(this.props.numberLabel)}</span>
        </span>
      </div>;
    } else {var sidebarNum = null;}

    return (
      <div className={classes} onClick={this.handleClick}>
        {sidebarNum}
        {this.props.hideTitle ? null :

        (<div className="title">
          <div className="titleBox">
            <span className="en" >{title}</span>
            <span className="he">{heTitle}</span>
          </div>
        </div>)}
        <div className="text">
          <div className="textInner">
            { textSegments }
            { this.props.showActionLinks ? actionLinks : null }
          </div>
        </div>
      </div>
    );
  }
}

TextRange.propTypes = {
  sref:                   PropTypes.string.isRequired,
  version:                PropTypes.string,
  versionLanguage:        PropTypes.string,
  highlightedRefs:        PropTypes.array,
  basetext:               PropTypes.bool,
  withContext:            PropTypes.bool,
  hideTitle:              PropTypes.bool,
  loadLinks:              PropTypes.bool,
  prefetchNextPrev:       PropTypes.bool,
  openOnClick:            PropTypes.bool,
  lowlight:               PropTypes.bool,
  numberLabel:            PropTypes.number,
  settings:               PropTypes.object,
  filter:                 PropTypes.array,
  onTextLoad:             PropTypes.func,
  onRangeClick:           PropTypes.func,
  onSegmentClick:         PropTypes.func,
  onCitationClick:        PropTypes.func,
  onNavigationClick:      PropTypes.func,
  onCompareClick:         PropTypes.func,
  onOpenConnectionsClick: PropTypes.func,
  showBaseText:           PropTypes.func,
  panelsOpen:             PropTypes.number,
  layoutWidth:            PropTypes.number,
  showActionLinks:        PropTypes.bool,
  inlineReference:        PropTypes.object,

};


class TextSegment extends Component {
  handleClick(event) {
    if ($(event.target).hasClass("refLink")) {
      //Click of citation
      event.preventDefault();//add prevent default
      var ref = Sefaria.humanRef($(event.target).attr("data-ref"));
      this.props.onCitationClick(ref, this.props.sref);
      event.stopPropagation();
      Sefaria.site.track.event("Reader", "Citation Link Click", ref);
    } else if ($(event.target).is("sup") || $(event.target).parents("sup").size()) {
      this.props.onFootnoteClick(event);
      event.stopPropagation();
    } else if (this.props.onSegmentClick) {
      this.props.onSegmentClick(this.props.sref);
      Sefaria.site.track.event("Reader", "Text Segment Click", this.props.sref);
    }
  }
  render() {
    var linkCountElement;
    if (this.props.showLinkCount) {
      var linkCount = Sefaria.linkCount(this.props.sref, this.props.filter);
      var minOpacity = 20, maxOpacity = 70;
      var linkScore = linkCount ? Math.min(linkCount+minOpacity, maxOpacity) / 100.0 : 0;
      var style = {opacity: linkScore};
      linkCountElement = this.props.showLinkCount ? (<div className="linkCount sans" title={linkCount + " Connections Available"}>
                                                    <span className="en"><span className="linkCountDot" style={style}></span></span>
                                                    <span className="he"><span className="linkCountDot" style={style}></span></span>
                                                  </div>) : null;
    } else {
      linkCountElement = "";
    }
    var segmentNumber = this.props.segmentNumber ? (<div className="segmentNumber sans">
                                                      <span className="en"> <span className="segmentNumberInner">{this.props.segmentNumber}</span> </span>
                                                      <span className="he"> <span className="segmentNumberInner">{Sefaria.hebrew.encodeHebrewNumeral(this.props.segmentNumber)}</span> </span>
                                                    </div>) : null;
    var he = this.props.he || "";

    // render itags
    if (this.props.filter && this.props.filter.length > 0) {
      var $newElement = $("<div>" + he + "</div>");
      var textValue = function(i) {
        if ($(i).attr('data-label')) {
          return $(i).attr('data-label');
        } else {
          var value = Sefaria.hebrew.encodeHebrewNumeral($(i).attr('data-order'));
        }
        if (value === undefined) {
          value = $(i).attr('data-order');
        }
        return value;
      };
      $newElement.find('i[data-commentator="' + this.props.filter[0] + '"]').each(function () {
        $(this).replaceWith('<sup class="itag">' + textValue(this) + "</sup>");
      });
      he = $newElement.html();
    }

    var en = this.props.en || "";
    var classes=classNames({ segment: 1,
                     highlight: this.props.highlight,
                     heOnly: !this.props.en,
                     enOnly: !this.props.he });
    if(!this.props.en && !this.props.he){
        return false;
    }
    return (
      <span className={classes} onClick={this.handleClick} data-ref={this.props.sref}>
        {segmentNumber}
        {linkCountElement}
        <span className="he" dangerouslySetInnerHTML={ {__html: he + " "} }></span>
        <span className="en" dangerouslySetInnerHTML={ {__html: en + " "} }></span>
        <div className="clearFix"></div>
      </span>
    );
  }
}

TextSegment.propTypes = {
  sref:            PropTypes.string,
  en:              PropTypes.string,
  he:              PropTypes.string,
  highlight:       PropTypes.bool,
  segmentNumber:   PropTypes.number,
  showLinkCount:   PropTypes.bool,
  filter:          PropTypes.array,
  onCitationClick: PropTypes.func,
  onSegmentClick:  PropTypes.func,
  onFootnoteClick: PropTypes.func
};


class ConnectionsPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {flashMessage: null};
  }
  componentDidMount() {
    this._isMounted = true;
    this.loadData();
  }
  componentWillUnmount() {
    this._isMounted = false;
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.loadData();
    }
    // Turn on the lexicon when receiving new words if they are less than 3
    // and don't span refs.
    if (!prevProps.selectedWords && this.props.selectedWords &&
        this.props.selectedWords.split(" ").length < 3 &&
        this.props.srefs.length == 1) {
      this.props.setConnectionsMode("Lexicon");
    }
    // Go back to main sidebar when words are unselected
    if (prevProps.selectedWords && prevProps.mode === "Lexicon" && !this.props.selectedWords) {
      this.props.setConnectionsMode("Resources");
    }
  }
  sectionRef() {
    return Sefaria.sectionRef(Sefaria.humanRef(this.props.srefs)) || this.props.srefs;
  }
  loadData() {
    var ref = this.sectionRef();
    if (!Sefaria.related(ref)) {
      Sefaria.related(ref, function() {
        if (this._isMounted) {
          this.forceUpdate();
        }
      }.bind(this));
    }
  }
  reloadData() {
    Sefaria.clearLinks();
    this.loadData();
  }
  flashMessage(msg) {
    this.setState({flashMessage: msg});
    setTimeout(function() {
      this.setState({flashMessage: null});
    }.bind(this), 3000);
  }
  render() {
    var content = null;
    var loaded = Sefaria.linksLoaded(this.sectionRef());
    if (!loaded) {
      content = <LoadingMessage />;
    } else if (this.props.mode == "Resources") {
      var sheetsCount = Sefaria.sheets.sheetsTotalCount(this.props.srefs);
      var notesCount  = Sefaria.notesTotalCount(this.props.srefs);
      content = (<div>
                  { this.state.flashMessage ?
                    <div className="flashMessage sans">{this.state.flashMessage}</div>
                    : null }
                  <ConnectionsSummary
                    srefs={this.props.srefs}
                    showBooks={false}
                    multiPanel={this.props.multiPanel}
                    filter={this.props.filter}
                    contentLang={this.props.contentLang}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    setConnectionsCategory={this.props.setConnectionsCategory} />
                  <ResourcesList
                    multiPanel={this.props.multiPanel}
                    setConnectionsMode={this.props.setConnectionsMode}
                    openComparePanel={this.props.openComparePanel}
                    sheetsCount={sheetsCount}
                    notesCount={notesCount} />
                  </div>);

    } else if (this.props.mode === "ConnectionsList") {
      content = (<ConnectionsSummary
                    srefs={this.props.srefs}
                    category={this.props.connectionsCategory}
                    showBooks={true}
                    multiPanel={this.props.multiPanel}
                    contentLang={this.props.contentLang}
                    filter={this.props.filter}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    setConnectionsCategory={this.props.setConnectionsCategory} />);

    } else if (this.props.mode === "TextList") {
      content = (<TextList
                    srefs={this.props.srefs}
                    filter={this.props.filter}
                    recentFilters={this.props.recentFilters}
                    fullPanel={this.props.fullPanel}
                    multiPanel={this.props.multiPanel}
                    contentLang={this.props.conteLang}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    onTextClick={this.props.onTextClick}
                    onCitationClick={this.props.onCitationClick}
                    onNavigationClick={this.props.onNavigationClick}
                    onCompareClick={this.props.onCompareClick}
                    onOpenConnectionsClick={this.props.onOpenConnectionsClick}
                    openNav={this.props.openNav}
                    openDisplaySettings={this.props.openDisplaySettings}
                    closePanel={this.props.closePanel}
                    selectedWords={this.props.selectedWords}/>);

    } else if (this.props.mode === "Sheets") {
      content = (<div>
                  <AddToSourceSheetBox
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel}
                    setConnectionsMode={this.props.setConnectionsMode}
                    version={this.props.version}
                    versionLanguage={this.props.versionLanguage}
                    addToSourceSheet={this.props.addToSourceSheet} />
                  { Sefaria._uid ?
                  <a href="/sheets/private" className="allSheetsLink button transparent bordered fillWidth squareBorder">
                    <span className="int-en">Go to My Sheets</span>
                    <span className="int-he">דפי המקורות שלי</span>
                  </a>
                  : null }
                  <MySheetsList
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel} />
                  <PublicSheetsList
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel} />
                </div>);

    } else if (this.props.mode === "Notes") {
      content = (<div>
                  <AddNoteBox
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel}
                    closePanel={this.props.closePanel}
                    onSave={() => this.props.setConnectionsMode("Notes")}
                    onCancel={() => this.props.setConnectionsMode("Notes")} />
                  { Sefaria._uid ?
                  <a href="/my/notes" className="allNotesLink button transparent bordered fillWidth squareBorder">
                    <span className="int-en">Go to My Notes</span>
                    <span className="int-he">הרשומות שלי</span>
                  </a>
                  : null }
                  <MyNotes
                    srefs={this.props.srefs}
                    editNote={this.props.editNote} />
                </div>);

    } else if (this.props.mode === "Lexicon") {
      content = (<LexiconBox
                    selectedWords={this.props.selectedWords}
                    oref={Sefaria.ref(this.props.srefs[0])} />);

    } else if (this.props.mode === "Tools") {
      content = (<ToolsList
                    srefs={this.props.srefs}
                    mode={this.props.mode}
                    filter={this.props.filter}
                    recentFilters={this.props.recentFilters}
                    fullPanel={this.props.fullPanel}
                    multiPanel={this.props.multiPanel}
                    canEditText={this.props.canEditText}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    onTextClick={this.props.onTextClick}
                    onCitationClick={this.props.onCitationClick}
                    onNavigationClick={this.props.onNavigationClick}
                    onCompareClick={this.props.onCompareClick}
                    onOpenConnectionsClick={this.props.onOpenConnectionsClick}
                    openNav={this.props.openNav}
                    openDisplaySettings={this.props.openDisplaySettings}
                    openComparePanel={this.props.openComparePanel}
                    closePanel={this.props.closePanel}
                    version={this.props.version}
                    versionLanguage={this.props.versionLanguage} />);

    } else if (this.props.mode === "Share") {
      content = (<ShareBox
                    url={window.location.href}
                    fullPanel={this.props.fullPanel}
                    closePanel={this.props.closePanel}
                    setConnectionsMode={this.props.setConnectionsMode} />);

    } else if (this.props.mode === "Edit Note") {
      content = (<AddNoteBox
                    srefs={this.props.srefs}
                    noteId={this.props.noteBeingEdited._id}
                    noteText={this.props.noteBeingEdited.text}
                    noteTitle={this.props.noteBeingEdited.title}
                    noteIsPublic={this.props.noteBeingEdited.isPublic}
                    fullPanel={this.props.fullPanel}
                    closePanel={this.props.closePanel}
                    onSave={() => this.props.setConnectionsMode("Notes")}
                    onCancel={() => this.props.setConnectionsMode("Notes")}
                    onDelete={() => this.props.setConnectionsMode("Notes")} />);

    } else if (this.props.mode === "Add Connection") {
      var onSave = function() {
        this.reloadData();
        this.props.setConnectionsMode("Resources");
        this.flashMessage("Success! You've created a new connection.");
      }.bind(this);
      content = <AddConnectionBox
                    srefs={this.props.allOpenRefs}
                    openComparePanel={this.props.openComparePanel}
                    onSave={onSave}
                    onCancel={() => this.props.setConnectionsMode("Resources")} />

    } else if (this.props.mode === "Login") {
      content = (<LoginPrompt fullPanel={this.props.fullPanel} />);
    }

    var classes = classNames({connectionsPanel: 1, textList: 1, fullPanel: this.props.fullPanel, singlePanel: !this.props.fullPanel});
    return (
      <div className={classes} key={this.props.mode}>
        { this.props.fullPanel ? null :
          <ConnectionsPanelHeader
            connectionsMode={this.props.mode}
            previousCategory={this.props.connectionsCategory}
            setConnectionsMode={this.props.setConnectionsMode}
            setConnectionsCategory={this.props.setConnectionsCategory}
            multiPanel={this.props.multiPanel}
            filter={this.props.filter}
            recentFilters={this.props.recentFilters}
            baseRefs={this.props.srefs}
            setFilter={this.props.setFilter}
            closePanel={this.props.closePanel}
            toggleLanguage={this.props.toggleLanguage}
            interfaceLang={this.props.interfaceLang}/> }
        <div className="texts">
          <div className="contentInner">{content}</div>
        </div>
      </div>);

  }
}

ConnectionsPanel.propTypes = {
  srefs:                   PropTypes.array.isRequired,  // an array of ref strings
  filter:                  PropTypes.array.isRequired,
  recentFilters:           PropTypes.array.isRequired,
  mode:                    PropTypes.string.isRequired, // "Resources", "ConnectionsList", "TextList" etc., called `connectionsMode` above
  connectionsCategory:     PropTypes.string,            // with mode:"ConnectionsList", which category of connections to show
  setFilter:               PropTypes.func.isRequired,
  setConnectionsMode:      PropTypes.func.isRequired,
  setConnectionsCategory:  PropTypes.func.isRequired,
  editNote:                PropTypes.func.isRequired,
  openComparePanel:        PropTypes.func.isRequired,
  addToSourceSheet:        PropTypes.func.isRequired,
  version:                 PropTypes.string,
  versionLanguage:         PropTypes.string,
  noteBeingEdited:         PropTypes.object,
  fullPanel:               PropTypes.bool,
  multiPanel:              PropTypes.bool,
  canEditText:             PropTypes.bool,
  onTextClick:             PropTypes.func,
  onCitationClick:         PropTypes.func,
  onNavigationClick:       PropTypes.func,
  onCompareClick:          PropTypes.func,
  onOpenConnectionsClick:  PropTypes.func,
  openNav:                 PropTypes.func,
  openDisplaySettings:     PropTypes.func,
  closePanel:              PropTypes.func,
  toggleLanguage:          PropTypes.func,
  selectedWords:           PropTypes.string,
  interfaceLang:           PropTypes.string,
  contentLang:             PropTypes.string,

};


class ConnectionsPanelHeader extends Component {
  componentDidMount() {
    this.setMarginForScrollbar();
  }
  setMarginForScrollbar() {
    // Scrollbars take up spacing, causing the centering of ConnectsionPanel to be slightly off center
    // compared to the header. This functions sets appropriate margin to compensate.
    var width      = Sefaria.util.getScrollbarWidth();
    var $container = $(ReactDOM.findDOMNode(this));
    if (this.props.interfaceLang == "hebrew") {
      $container.css({marginRight: 0, marginLeft: width});
    } else {
      $container.css({marginRight: width, marginLeft: 0});
    }
  }
  render() {
    if (this.props.connectionsMode == "Resources") {
      // Top Level Menu
      var title = <div className="connectionsHeaderTitle">
                    {this.props.interfaceLang == "english" ? <div className="int-en">Resources</div> : null }
                    {this.props.interfaceLang == "hebrew" ? <div className="int-he">קישורים וכלים</div> : null }
                  </div>;
    } else if (this.props.previousCategory && this.props.connectionsMode == "TextList") {
      // In a text list, back to Previous Categoy

      var url = Sefaria.util.replaceUrlParam("with", this.props.previousCategory);
      var onClick = function(e) {
        this.props.setConnectionsCategory(this.props.previousCategory);
        e.preventDefault();
      }.bind(this);
      var title = <a href={url} className="connectionsHeaderTitle active" onClick={onClick}>
                    {this.props.interfaceLang == "english" ? <div className="int-en"><i className="fa fa-chevron-left"></i>{this.props.multiPanel ? this.props.previousCategory : null }</div> : null }
                    {this.props.interfaceLang == "hebrew" ? <div className="int-he"><i className="fa fa-chevron-right"></i>{this.props.multiPanel ? Sefaria.hebrewTerm(this.props.previousCategory) : null }</div> : null }
                  </a>;

    } else {
      // Anywhere else, back to Top Level
      var url = Sefaria.util.replaceUrlParam("with", "all");
      var onClick = function(e) {
        e.preventDefault();
        this.props.setConnectionsMode("Resources");
      }.bind(this);
      var title = <a href={url} className="connectionsHeaderTitle active" onClick={onClick}>
                    {this.props.interfaceLang == "english" ? <div className="int-en"><i className="fa fa-chevron-left"></i>Resources</div> : null }
                    {this.props.interfaceLang == "hebrew" ? <div className="int-he"><i className="fa fa-chevron-right"></i>משאבים</div> : null }
                  </a>;
    }
    if (this.props.multiPanel) {
      var toggleLang = Sefaria.util.getUrlVars()["lang2"] == "en" ? "he" : "en";
      var langUrl = Sefaria.util.replaceUrlParam("lang2", toggleLang);
      var closeUrl = Sefaria.util.removeUrlParam("with");
      return (<div className="connectionsPanelHeader">
                {title}
                <div className="rightButtons">
                  <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} url={langUrl} />
                  <ReaderNavigationMenuCloseButton icon="circledX" onClick={this.props.closePanel} url={closeUrl} />
                </div>
              </div>);
    } else {
      var style = !this.props.multiPanel && this.props.connectionsMode == "TextList" ? {"borderTopColor": Sefaria.palette.categoryColor(this.props.previousCategory)} : {}
      var cStyle = !this.props.multiPanel && this.props.connectionsMode == "Resources" ? {"justifyContent": "center"} : style;
      // Modeling the class structure when ConnectionsPanelHeader is created inside ReaderControls in the multiPanel case
      var classes = classNames({readerControls: 1, connectionsHeader: 1, fullPanel: this.props.multiPanel});
      return (<div className={classes} style={style}>
                <div className="readerControlsInner">
                  <div className="readerTextToc">
                    <div className="connectionsPanelHeader" style={cStyle}>
                      {title}
                      {!this.props.multiPanel && this.props.previousCategory && this.props.connectionsMode == "TextList" ?
                      <RecentFilterSet
                        srefs={this.props.baseRefs}
                        asHeader={true}
                        filter={this.props.filter}
                        recentFilters={this.props.recentFilters}
                        textCategory={this.props.previousCategory}
                        setFilter={this.props.setFilter} />
                        : null }
                    </div>
                  </div>
                </div>
        </div>);
    }
  }
}

ConnectionsPanelHeader.propTypes = {
    connectionsMode:        PropTypes.string.isRequired, // "Resources", "ConnectionsList", "TextList" etc
    previousCategory:       PropTypes.string,
    multiPanel:             PropTypes.bool,
    filter:                 PropTypes.array,
    recentFilters:          PropTypes.array,
    baseRefs:               PropTypes.array,
    setFilter:              PropTypes.func,
    setConnectionsMode:     PropTypes.func.isRequired,
    setConnectionsCategory: PropTypes.func.isRequired,
    closePanel:             PropTypes.func.isRequired,
    toggleLanguage:         PropTypes.func.isRequired,
    interfaceLang:          PropTypes.string.isRequired
};




class ResourcesList extends Component {
  // A list of Resources in addtion to connections
  render() {
    return (<div className="resourcesList">
              {this.props.multiPanel ?
                <ToolsButton en="Other Text" he="השווה" icon="search" onClick={this.props.openComparePanel} />
              : null }
              <ToolsButton en="Sheets" he="דפי מקורות" image="sheet.svg" count={this.props.sheetsCount} onClick={() => this.props.setConnectionsMode("Sheets")} />
              <ToolsButton en="Notes" he="הרשומות שלי" image="tools-write-note.svg" count={this.props.notesCount} onClick={() => this.props.setConnectionsMode("Notes")} />
              <ToolsButton en="Tools" he="כלים" icon="gear" onClick={() => this.props.setConnectionsMode("Tools")} />
            </div>);
  }
}

ResourcesList.propTypes = {
  multiPanel:         PropTypes.bool.isRequired,
  setConnectionsMode: PropTypes.func.isRequired,
  openComparePanel:   PropTypes.func.isRequired,
  sheetsCount:        PropTypes.number.isRequired,
  notesCount:         PropTypes.number.isRequired,
}


class ConnectionsSummary extends Component {
  // A summary of available connections on `srefs`.
  // If `category` is present, shows a single category, otherwise all categories.
  // If `showBooks`, show specific text counts beneath each category.
  render() {
    var refs    = this.props.srefs;
    var summary = Sefaria.linkSummary(refs);
    var oref    = Sefaria.ref(refs[0]);
    var baseCat = oref ? oref["categories"][0] : null;

    if (!summary) { return (<LoadingMessage />); }

    if (this.props.category == "Commentary" ) {
      // Show Quoting Commentary together with Commentary
      summary = summary.filter(function(cat) { return cat.category == "Commentary" || cat.category == "Quoting Commentary" });

    } else if (this.props.category) {
      // Single Category Summary
      summary = summary.filter(function(cat) { return cat.category == this.props.category; }.bind(this));
      if (summary.length == 0) {
        summary = [{category: this.props.category, books: [], count: 0}];
      }

    } else if (!this.props.category) {
      // Top Level summary, don't show Quoting Commentary
      summary = summary.filter(function(cat) { return cat.category != "Quoting Commentary"; }.bind(this));
    }

    var connectionsSummary = summary.map(function(cat, i) {


      var books = this.props.contentLang == "hebrew"
                    ? cat.books.concat().sort(Sefaria.linkSummaryBookSortHebrew.bind(null, baseCat))
                    : cat.books;
      return (
        <CategoryFilter
          srefs={this.props.srefs}
          category={cat.category}
          heCategory={Sefaria.hebrewTerm(cat.category)}
          showBooks={this.props.showBooks}
          count={cat.count}
          books={books}
          filter={this.props.filter}
          updateRecent={true}
          setFilter={this.props.setFilter}
          setConnectionsCategory={this.props.setConnectionsCategory}
          on={Sefaria.util.inArray(cat.category, this.props.filter) !== -1}
          key={cat.category} />
      );
    }.bind(this));

    return (<div>{connectionsSummary}</div>);
   }
}

ConnectionsSummary.propTypes = {
  srefs:                   PropTypes.array.isRequired, // an array of ref strings
  category:                PropTypes.string, // if present show connections for category, if null show category summary
  filter:                  PropTypes.array,
  fullPanel:               PropTypes.bool,
  multiPanel:              PropTypes.bool,
  contentLang:             PropTypes.string,
  showBooks:               PropTypes.bool,
  setConnectionsMode:      PropTypes.func,
  setFilter:               PropTypes.func,
  setConnectionsCategory:  PropTypes.func.isRequired,
};


class CategoryFilter extends Component {
  // A clickable representation of category of connections, include counts.
  // If `showBooks` list connections broken down by book as well.
  handleClick(e) {
    e.preventDefault();
    if (this.props.showBooks) {
      this.props.setFilter(this.props.category, this.props.updateRecent);
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Category Filter Click", this.props.category); }
    } else {
      this.props.setConnectionsCategory(this.props.category);
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Connections Category Click", this.props.category); }
    }
  }
  render() {
    var filterSuffix = this.props.category  == "Quoting Commentary" ? "|Quoting" : null;
    var textFilters = this.props.showBooks ? this.props.books.map(function(book, i) {
     return (<TextFilter
                srefs={this.props.srefs}
                key={i}
                book={book.book}
                heBook={book.heBook}
                count={book.count}
                category={this.props.category}
                hideColors={true}
                updateRecent={true}
                filterSuffix={filterSuffix}
                setFilter={this.props.setFilter}
                on={Sefaria.util.inArray(book.book, this.props.filter) !== -1} />);
    }.bind(this)) : null;

    var color        = Sefaria.palette.categoryColor(this.props.category);
    var style        = {"borderTop": "4px solid " + color};
    var innerClasses = classNames({categoryFilter: 1, withBooks: this.props.showBooks, on: this.props.on});
    var count        = (<span className="enInHe connectionsCount"> ({this.props.count})</span>);
    var handleClick  = this.handleClick;
    var url = (this.props.srefs && this.props.srefs.length > 0)?"/" + Sefaria.normRef(this.props.srefs[0]) + "?with=" + this.props.category:"";
    var innerFilter = (
      <div className={innerClasses} data-name={this.props.category}>
        <span className="en">{this.props.category}{count}</span>
        <span className="he">{this.props.heCategory}{count}</span>
      </div>);
    var wrappedFilter = <a href={url} onClick={handleClick}>{innerFilter}</a>;
    var outerClasses = classNames({categoryFilterGroup: 1, withBooks: this.props.showBooks});
    return (
      <div className={outerClasses} style={style}>
        {wrappedFilter}
        {textFilters}
      </div>
    );
  }
}

CategoryFilter.propTypes = {
  srefs:                  PropTypes.array.isRequired,
  category:               PropTypes.string.isRequired,
  heCategory:             PropTypes.string.isRequired,
  showBooks:              PropTypes.bool.isRequired,
  count:                  PropTypes.number.isRequired,
  books:                  PropTypes.array.isRequired,
  filter:                 PropTypes.array.isRequired,
  updateRecent:           PropTypes.bool.isRequired,
  setFilter:              PropTypes.func.isRequired,
  setConnectionsCategory: PropTypes.func.isRequired,
  on:                     PropTypes.bool,
};


class TextFilter extends Component {
  // A clickable representation of connections by Text or Commentator
  handleClick(e) {
    e.preventDefault();
    var filter = this.props.filterSuffix ? this.props.book + this.props.filterSuffix : this.props.book;
    this.props.setFilter(filter, this.props.updateRecent);
    if (Sefaria.site) {
      if (this.props.inRecentFilters) { Sefaria.site.track.event("Reader", "Text Filter in Recent Click", filter); }
      else { Sefaria.site.track.event("Reader", "Text Filter Click", filter); }
    }
  }
  render() {
    var classes = classNames({textFilter: 1, on: this.props.on, lowlight: this.props.count == 0});

    if (!this.props.hideColors) {
      var color = Sefaria.palette.categoryColor(this.props.category);
      var style = {"borderTop": "4px solid " + color};
    }
    var name = this.props.book == this.props.category ? this.props.book.toUpperCase() : this.props.book;
    var count = this.props.hideCounts || !this.props.count ? "" : ( <span className="enInHe connectionsCount">&nbsp;({this.props.count})</span>);
    var url = (this.props.srefs && this.props.srefs.length > 0)?"/" + Sefaria.normRef(this.props.srefs[0]) + "?with=" + name:"";
    return (
      <a href={url} onClick={this.handleClick}>
        <div data-name={name} className={classes} style={style} >
            <div>
              <span className="en">{name}{count}</span>
              <span className="he">{this.props.heBook}{count}</span>
            </div>
        </div>
      </a>
    );
  }
}

TextFilter.propTypes = {
  srefs:           PropTypes.array.isRequired,
  book:            PropTypes.string.isRequired,
  heBook:          PropTypes.string.isRequired,
  on:              PropTypes.bool.isRequired,
  setFilter:       PropTypes.func.isRequired,
  updateRecent:    PropTypes.bool,
  inRecentFilters: PropTypes.bool,
  filterSuffix:    PropTypes.string,  // Optionally add a string to the filter parameter set (but not displayed)
};


class TextList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      linksLoaded: false, // has the list of refs been loaded
      textLoaded:  false, // has the text of those refs been loaded
      waitForText: true,  // should we delay rendering texts until preload is finished
    }
  }
  componentDidMount() {
    this._isMounted = true;
    this.loadConnections();
  }
  componentWillUnmount() {
    this._isMounted = false;
  }
  componentWillReceiveProps(nextProps) {
    this.preloadText(nextProps.filter);
  }
  componentWillUpdate(nextProps) {
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.loadConnections();
    }
  }
  getSectionRef() {
    var ref = this.props.srefs[0]; // TODO account for selections spanning sections
    var sectionRef = Sefaria.sectionRef(ref) || ref;
    return sectionRef;
  }
  loadConnections() {
    // Load connections data from server for this section
    var sectionRef = this.getSectionRef();
    if (!sectionRef) { return; }
    Sefaria.related(sectionRef, function(data) {
      if (this._isMounted) {
        this.preloadText(this.props.filter);
        this.setState({
          linksLoaded: true,
        });
      }
    }.bind(this));
  }
  onDataChange() {
    this.setState({linksLoaded: false});
    this.loadConnections();
  }
  preloadText(filter) {
    // Preload text of links if `filter` is a single commentary, or all commentary
    if (filter.length == 1 &&
        Sefaria.index(filter[0]) && // filterSuffix for quoting commmentary prevents this path for QC
        (Sefaria.index(filter[0]).categories[0] == "Commentary"||
         Sefaria.index(filter[0]).primary_category == "Commentary")) {
      // Individual commentator names ("Rashi") are put into Sefaria.index with "Commentary" as first category
      // Intentionally fails when looking up "Rashi on Genesis", which indicates we're looking at a quoting commentary.
      this.preloadSingleCommentaryText(filter);

    } else if (filter.length == 1 && filter[0] == "Commentary") {
      this.preloadAllCommentaryText(filter);

    } else {
      this.setState({waitForText: false, textLoaded: false});
    }
  }
  preloadSingleCommentaryText(filter) {
    // Preload commentary for an entire section of text.
    this.setState({textLoaded: false});
    var commentator       = filter[0];
    var basetext          = this.getSectionRef();
    var commentarySection = Sefaria.commentarySectionRef(commentator, basetext);
    if (!commentarySection) { return; }

    this.setState({waitForText: true});
    Sefaria.text(commentarySection, {}, function() {
      if (this._isMounted) {
        this.setState({textLoaded: true});
      }
    }.bind(this));
  }
  preloadAllCommentaryText() {
    var basetext   = this.getSectionRef();
    var summary    = Sefaria.linkSummary(basetext);
    if (summary.length && summary[0].category == "Commentary") {
      this.setState({textLoaded: false, waitForText: true});
      // Get a list of commentators on this section that we need don't have in the cache
      var links = Sefaria.links(basetext);
      var commentators = summary[0].books.map(function(item) {
        return item.book;
      });

      if (commentators.length) {
        var commentarySections = commentators.map(function(commentator) {
          return Sefaria.commentarySectionRef(commentator, basetext);
        }).filter(function(commentarySection) {
          return !!commentarySection;
        });
        this.waitingFor = Sefaria.util.clone(commentarySections);
        this.target = 0;
        for (var i = 0; i < commentarySections.length; i++) {
          Sefaria.text(commentarySections[i], {}, function(data) {
            var index = this.waitingFor.indexOf(data.commentator);
            if (index == -1) {
                // console.log("Failed to clear commentator:");
                // console.log(data);
                this.target += 1;
            }
            if (index > -1) {
                this.waitingFor.splice(index, 1);
            }
            if (this.waitingFor.length == this.target) {
              if (this._isMounted) {
                this.setState({textLoaded: true});
              }
            }
          }.bind(this));
        }
      } else {
        // All commentaries have been loaded already
        this.setState({textLoaded: true});
      }
    } else {
      // There were no commentaries to load
      this.setState({textLoaded: true});
    }
  }
  getLinks() {
    var refs               = this.props.srefs;
    var filter             = this.props.filter;
    var sectionRef         = this.getSectionRef();

    var sortConnections = function(a, b) {
      if (a.anchorVerse !== b.anchorVerse) {
        return a.anchorVerse - b.anchorVerse;
      }
      if (a.index_title == b.index_title) {
        return a.commentaryNum - b.commentaryNum;
      }
      if (this.props.contentLang == "hebrew") {
        var indexA = Sefaria.index(a.index_title);
        var indexB = Sefaria.index(b.index_title);
        return indexA.heTitle > index.heTitle ? 1 : -1;
      }
      else {
        return a.sourceRef > b.sourceRef ? 1 : -1;
      }
    }.bind(this);

    var sectionLinks = Sefaria.links(sectionRef);
    var links        = Sefaria._filterLinks(sectionLinks, filter);
    links            = links.filter(function(link) {
      if (Sefaria.splitSpanningRef(link.anchorRef).every(aref => Sefaria.util.inArray(aref, refs) === -1)) {
        // Filter out every link in this section which does not overlap with current refs.
        return false;
      }
      return true;
    }.bind(this)).sort(sortConnections);

    return links;
  }
  render() {
    var refs               = this.props.srefs;
    var oref               = Sefaria.ref(refs[0]);
    var filter             = this.props.filter; // Remove filterSuffix for display
    var displayFilter      = filter.map(filter => filter.split("|")[0]);  // Remove filterSuffix for display
    var links              = this.getLinks();

    var en = "No connections known" + (filter.length ? " for " + displayFilter.join(", ") + " here" : "") + ".";
    var he = "אין קשרים ידועים"        + (filter.length ? " ל"    + displayFilter.map(f => Sefaria.hebrewTerm(f)).join(", ") : "") + ".";
    var noResultsMessage = <LoadingMessage message={en} heMessage={he} />;
    var message = !this.state.linksLoaded ? (<LoadingMessage />) : (links.length === 0 ? noResultsMessage : null);
    var content = links.length == 0 ? message :
                  this.state.waitForText && !this.state.textLoaded ?
                    (<LoadingMessage />) :
                    links.map(function(link, i) {
                        var hideTitle = link.category === "Commentary" && this.props.filter[0] !== "Commentary";
                        Sefaria.util.inArray(link.anchorRef, refs) === -1;
                        return (<div className="textListTextRangeBox" key={i + link.sourceRef}>
                                  <TextRange
                                    sref={link.sourceRef}
                                    hideTitle={hideTitle}
                                    numberLabel={link.category === "Commentary" ? link.anchorVerse : 0}
                                    basetext={false}
                                    onRangeClick={this.props.onTextClick}
                                    onCitationClick={this.props.onCitationClick}
                                    onNavigationClick={this.props.onNavigationClick}
                                    onCompareClick={this.props.onCompareClick}
                                    onOpenConnectionsClick={this.props.onOpenConnectionsClick}
                                    inlineReference={link.inline_reference}/>
                                    {Sefaria.is_moderator ?
                                    <ModeratorLinkOptions
                                      _id={link._id}
                                      onDataChange={ this.onDataChange } />
                                    : null}
                                </div>);
                      }, this);
    return (
        <div>
          {this.props.fullPanel ?
          <RecentFilterSet
            srefs={this.props.srefs}
            asHeader={false}
            showText={this.props.showText}
            filter={this.props.filter}
            recentFilters={this.props.recentFilters}
            textCategory={oref ? oref.primary_category : null}
            setFilter={this.props.setFilter}
            showAllFilters={this.showAllFilters} />
            : null }
          { content }
        </div>);
  }
}

TextList.propTypes = {
  srefs:                   PropTypes.array.isRequired,    // an array of ref strings
  filter:                  PropTypes.array.isRequired,
  recentFilters:           PropTypes.array.isRequired,
  fullPanel:               PropTypes.bool,
  multiPanel:              PropTypes.bool,
  contentLang:             PropTypes.string,
  setFilter:               PropTypes.func,
  setConnectionsMode:      PropTypes.func,
  onTextClick:             PropTypes.func,
  onCitationClick:         PropTypes.func,
  onNavigationClick:       PropTypes.func,
  onCompareClick:          PropTypes.func,
  onOpenConnectionsClick:  PropTypes.func,
  onDataChange:            PropTypes.func,
  openNav:                 PropTypes.func,
  openDisplaySettings:     PropTypes.func,
  closePanel:              PropTypes.func,
  selectedWords:           PropTypes.string,
};




class ModeratorLinkOptions extends Component {
  constructor(props) {
    super(props);
    this.state = {collapsed: false};
  }
  expand() {
    this.setState({collapsed: false});
  }
  deleteLink () {
    if (confirm("Are you sure you want to delete this connection?")) {
      var url = "/api/links/" + this.props._id;
      $.ajax({
        type: "delete",
        url: url,
        success: function() {
          Sefaria.clearLinks();
          this.props.onDataChange();
          alert("Connection deleted.");
        }.bind(this),
        error: function () {
          alert("There was an error deleting this connection. Please reload the page or try again later.");
        }
      });
    }
  }
  render () {
    if (this.state.collapsed) {
      return <div className="moderatorLinkOptions" onClick={this.expand}><i className="fa fa-cog"></i></div>
    }

    return <div className="moderatorLinkOptions sans">
      <div className="moderatorLinkOptionsDelete" onClick={this.deleteLink}>
        <span className="int-en">Remove</span>
        <span className="int-he">מחק</span>
      </div>
    </div>
  }
}

ModeratorLinkOptions.propTypes = {
  _id:          PropTypes.string.isRequired,
  onDataChange: PropTypes.func
};


class RecentFilterSet extends Component {
  // A toggle-able listing of currently and recently used text filters.
  toggleAllFilterView() {
    this.setState({showAllFilters: !this.state.showAllFilters});
  }
  render() {

    var topLinks = [];

    // Annotate filter texts with category
    var recentFilters = this.props.recentFilters.map(function(filter) {
      var filterAndSuffix = filter.split("|");
      filter              = filterAndSuffix[0];
      var filterSuffix    = filterAndSuffix.length == 2 ? filterAndSuffix[1] : null;
      var index           = Sefaria.index(filter);
      return {
          book: filter,
          filterSuffix: filterSuffix,
          heBook: index ? index.heTitle : Sefaria.hebrewTerm(filter),
          category: index ? index.primary_category : filter };
    });

    // If the current filter is not already in the top set, put it first
    if (this.props.filter.length) {
      var filter = this.props.filter[0];
      for (var i=0; i < topLinks.length; i++) {
        if (recentFilters[i].book == filter ||
            recentFilters[i].category == filter ) { break; }
      }
      if (i == recentFilters.length) {
        var index = Sefaria.index(filter);
        if (index) {
          var annotatedFilter = {book: filter, heBook: index.heTitle, category: index.primary_category };
        } else {
          var annotatedFilter = {book: filter, heBook: filter, category: "Other" };
        }

        recentFilters = [annotatedFilter].concat(topLinks).slice(0,5);
      } else {
        // topLinks.move(i, 0);
      }
    }
    var recentFilters = recentFilters.map(function(book) {
     return (<TextFilter
                srefs={this.props.srefs}
                key={book.book}
                book={book.book}
                heBook={book.heBook}
                category={book.category}
                hideCounts={true}
                hideColors={true}
                count={book.count}
                updateRecent={false}
                inRecentFilters={true}
                filterSuffix={book.filterSuffix}
                setFilter={this.props.setFilter}
                on={Sefaria.util.inArray(book.book, this.props.filter) !== -1} />);
    }.bind(this));

    var classes = classNames({recentFilterSet: 1, topFilters: this.props.asHeader, filterSet: 1});
    return (
      <div className={classes}>
        <div className="topFiltersInner">{recentFilters}</div>
      </div>
    );
  }
}

RecentFilterSet.propTypes = {
  srefs:         PropTypes.array.isRequired,
  filter:        PropTypes.array.isRequired,
  recentFilters: PropTypes.array.isRequired,
  textCategory:  PropTypes.string.isRequired,
  inHeader:      PropTypes.bool,
  setFilter:     PropTypes.func.isRequired,
};


class MySheetsList extends Component {
  // List of my sheets for a ref in the Sidebar
  render() {
    var sheets = Sefaria.sheets.userSheetsByRef(this.props.srefs);
    var content = sheets.length ? sheets.map(function(sheet) {
      return (<SheetListing sheet={sheet} key={sheet.sheetUrl} />)
    }) : null;
    return content && content.length ? (<div className="sheetList">{content}</div>) : null;
  }
}

MySheetsList.propTypes = {
  srefs: PropTypes.array.isRequired,
};


class PublicSheetsList extends Component {
  // List of public sheets for a ref in the sidebar
  render() {
    var sheets = Sefaria.sheets.sheetsByRef(this.props.srefs);
    var content = sheets.length ? sheets.filter(function(sheet) {
      // My sheets are show already in MySheetList
      return sheet.owner !== Sefaria._uid;
    }).map(function(sheet) {
      return (<SheetListing sheet={sheet} key={sheet.sheetUrl} />)
    }) : null;
    return content && content.length ? (<div className="sheetList">{content}</div>) : null;
  }
}

PublicSheetsList.propTypes = {
  srefs: PropTypes.array.isRequired,
};


class SheetListing extends Component {
  // A source sheet listed in the Sidebar
  handleSheetClick() {
    //console.log("Sheet Click Handled");
    if (Sefaria._uid == this.props.sheet.owner) {
      Sefaria.site.track.event("Tools", "My Sheet Click", this.props.sheet.sheetUrl);
    } else {
      Sefaria.site.track.event("Tools", "Sheet Click", this.props.sheet.sheetUrl);
    }
  }
  handleSheetOwnerClick() {
    Sefaria.site.track.event("Tools", "Sheet Owner Click", this.props.sheet.ownerProfileUrl);
  }
  handleSheetTagClick(tag) {
    Sefaria.site.track.event("Tools", "Sheet Tag Click", tag);
  }
  render() {
    var sheet = this.props.sheet;
    var viewsIcon = sheet.public ?
      <div className="sheetViews sans"><i className="fa fa-eye" title={sheet.views + " views"}></i> {sheet.views}</div>
      : <div className="sheetViews sans"><i className="fa fa-lock" title="Private"></i></div>;

    return (
      <div className="sheet" key={sheet.sheetUrl}>
        {viewsIcon}
        <a href={sheet.ownerProfileUrl} target="_blank" onClick={this.handleSheetOwnerClick}>
          <img className="sheetAuthorImg" src={sheet.ownerImageUrl} />
        </a>
        <a href={sheet.ownerProfileUrl} target="_blank" className="sheetAuthor" onClick={this.handleSheetOwnerClick}>{sheet.ownerName}</a>
        <a href={sheet.sheetUrl} target="_blank" className="sheetTitle" onClick={this.handleSheetClick}>
          <img src="/static/img/sheet.svg" className="sheetIcon"/>
          {sheet.title}
        </a>
        <div className="sheetTags">
          {sheet.tags.map(function(tag, i) {
            var separator = i == sheet.tags.length -1 ? null : <span className="separator">,</span>;
            return (<a href={"/sheets/tags/" + tag}
                        target="_blank"
                        className="sheetTag"
                        key={tag}
                        onClick={this.handleSheetTagClick.bind(null, tag)}>{tag}{separator}</a>)
          }.bind(this))}
        </div>
      </div>);
  }
}

SheetListing.propTypes = {
  sheet: PropTypes.object.isRequired,
};



class LexiconBox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      entries: [],
      loaded: false
    };
  }
  componentDidMount() {
    if(this.props.selectedWords){
      this.getLookups(this.props.selectedWords, this.props.oref);
    }
  }
  componentWillReceiveProps(nextProps) {
    // console.log("component will receive props: ", nextProps.selectedWords);
    if (!nextProps.selectedWords) {
      this.clearLookups();
    } else if (this.props.selectedWords != nextProps.selectedWords) {
      this.clearLookups();
      this.getLookups(nextProps.selectedWords, nextProps.oref);
    }
  }
  clearLookups() {
    this.setState({
      loaded: false,
      entries: []
    });
  }
  getLookups(words, oref) {
    if(this.shouldActivate(words)){
      // console.log('getting data: ', words, oref.ref);
      Sefaria.lexicon(words, oref.ref, function(data) {
        this.setState({
          loaded: true,
          entries: data
        });

        var action = (data.length == 0)? "Open No Result": "Open";
        action += " / " + oref.categories.join("/") + "/" + oref.book;
        Sefaria.site.track.event("Lexicon", action, words);

        // console.log('gotten data from Sefaria.js, state re-set: ', this, data);
      }.bind(this));
    }
  }
  shouldActivate(selectedWords){
    if(!selectedWords){
      return null;
    }
    var wordList = selectedWords.split(/[\s:\u05c3\u05be\u05c0.]+/);
    var inputLength = wordList.length;
    return (inputLength <= 3);
  }
  render() {
    if (!this.props.selectedWords) {
      return (
        <div className="lexicon-instructions">
          <span className="int-en">Highlight words to look up definitions.</span>
          <span className="int-he">סמן מילים כדי לחפש הגדרות</span>
        </div>);
    }

    var refCats = this.props.oref.categories.join(", "); //TODO: the way to filter by categories is very limiting.
    var enEmpty = 'No definitions found for "' + this.props.selectedWords + '".';
    var heEmpty = 'לא נמצאו תוצאות "' + this.props.selectedWords + '".';
    if(!this.shouldActivate(this.props.selectedWords)){
      //console.log("not rendering lexicon");
      return false;
    }
    var content;
    if(!this.state.loaded) {
      // console.log("lexicon not yet loaded");
      content = (<LoadingMessage message="Looking up words..." heMessage="מחפש מילים..."/>);
    } else if(this.state.entries.length == 0) {
      if (this.props.selectedWords.length == 0) {
        //console.log("empty words: nothing to render");
        return false;
      } else {
        //console.log("no results");
        content = (<LoadingMessage message={enEmpty} heMessage={heEmpty}/>);
      }
    }else{
      var entries = this.state.entries;
      content =  entries.filter(e => e['parent_lexicon_details']['text_categories'].length == 0 || e['parent_lexicon_details']['text_categories'].indexOf(refCats) > -1).map(function(entry, i) {
            return (<LexiconEntry data={entry} key={i} />)
          });
      content = content.length ? content : <LoadingMessage message={enEmpty} heMessage={heEmpty} />;
    }
    return (
        <div className="lexicon-content">
          <div className="lexicon-results">
            { content }
          </div>
        </div>
      );
  }
}

LexiconBox.propTypes = {
  selectedWords: PropTypes.string,
  oref:          PropTypes.object
};


class LexiconEntry extends Component {
  renderLexiconEntrySenses(content) {
		var grammar     = ('grammar' in content) ? '('+ content['grammar']['verbal_stem'] + ')' : "";
		var def         = ('definition' in content) ? content['definition'] : "";
    var notes       = ('notes' in content) ? (<span className="notes">{content['notes']}</span>) : "";
    var sensesElems = ('senses' in content) ? content['senses'].map((sense, i) => {
      return <div key={i}>{this.renderLexiconEntrySenses(sense)}</div>;
    }) : "";
    var senses = sensesElems.length ? (<ol className="senses">{sensesElems}</ol>) : "";
    return (
      <li className="sense">
        {grammar}
        {def}
        {notes}
        {senses}
      </li>
    );
  }
  renderLexiconAttribution () {
    var entry = this.props.data;
		var lexicon_dtls = entry['parent_lexicon_details'];
        return (
            <div>
                <span>
                  <a target="_blank"
                      href={('source_url' in lexicon_dtls) ? lexicon_dtls['source_url'] : ""}>
                    <span className="int-en">Source: </span>
                    <span className="int-he">מקור:</span>
                    {'source' in lexicon_dtls ? lexicon_dtls['source'] : lexicon_dtls['source_url']}
                  </a>
                </span>
                <span>
                  <a target="_blank"
                      href={('attribution_url' in lexicon_dtls) ? lexicon_dtls['attribution_url'] : ""}>
                    <span className="int-en">Creator: </span>
                    <span className="int-he">יוצר:</span>
                    {'attribution' in lexicon_dtls ? lexicon_dtls['attribution'] : lexicon_dtls['attribution_url']}
                  </a>
                </span>
            </div>
        );
  }
  render() {
    var entry = this.props.data;
    var headwordClassNames = classNames('headword', entry['parent_lexicon_details']["to_language"].slice(0,2));
    var definitionClassNames = classNames('definition-content', entry['parent_lexicon_details']["to_language"].slice(0,2));
    var entryHeadHtml =  (<span className="headword">{entry['headword']}</span>);
    var morphologyHtml = ('morphology' in entry['content']) ?  (<span className="morphology">({entry['content']['morphology']})</span>) :"";
    var senses = this.renderLexiconEntrySenses(entry['content']);
    var attribution = this.renderLexiconAttribution();
    return (
        <div className="entry">
          <div className={headwordClassNames}>{entryHeadHtml}</div>
          <div className={definitionClassNames}>{morphologyHtml}<ol className="definition">{senses}</ol></div>
          <div className="attribution">{attribution}</div>
        </div>
    );
  }
}

LexiconEntry.propTypes = {
  data: PropTypes.object.isRequired
};


class ToolsList extends Component {
  render() {
    var editText  = this.props.canEditText ? function() {
        var refString = this.props.srefs[0];
        var currentPath = Sefaria.util.currentPath();
        var currentLangParam;
        if (this.props.version) {
          refString += "/" + encodeURIComponent(this.props.versionLanguage) + "/" + encodeURIComponent(this.props.version);
        }
        var path = "/edit/" + refString;
        var nextParam = "?next=" + encodeURIComponent(currentPath);
        path += nextParam;
        Sefaria.site.track.event("Tools", "Edit Text Click", refString,
          {hitCallback: () =>  window.location = path}
        );
    }.bind(this) : null;

    var addTranslation = function() {
      var nextParam = "?next=" + Sefaria.util.currentPath();
      Sefaria.site.track.event("Tools", "Add Translation Click", this.props.srefs[0],
          {hitCallback: () => {window.location = "/translate/" + this.props.srefs[0] + nextParam}}
      );
    }.bind(this);

    return (
      <div>
        <ToolsButton en="Share" he="שתף" image="tools-share.svg" onClick={() => this.props.setConnectionsMode("Share")} />
        <ToolsButton en="Add Translation" he="הוסף תרגום" image="tools-translate.svg" onClick={addTranslation} />
        { Sefaria.is_moderator || Sefaria.is_editor ? <ToolsButton en="Add Connection" he="הוסף קישור לטקסט אחר" image="tools-add-connection.svg"onClick={() => this.props.setConnectionsMode("Add Connection")} /> : null }
        { editText ? (<ToolsButton en="Edit Text" he="ערוך טקסט" image="tools-edit-text.svg" onClick={editText} />) : null }
      </div>);
  }
}

ToolsList.propTypes = {
  srefs:               PropTypes.array.isRequired,  // an array of ref strings
  setConnectionsMode:  PropTypes.func.isRequired,
};


class ToolsButton extends Component {
  onClick(e) {
    e.preventDefault();
    this.props.onClick();
  }
  render() {
    var icon = null;
    if (this.props.icon) {
      var iconName = "fa-" + this.props.icon;
      var classes = {fa: 1, toolsButtonIcon: 1};
      classes[iconName] = 1;
      icon = (<i className={classNames(classes)} />)
    } else if (this.props.image) {
      icon = (<img src={"/static/img/" + this.props.image} className="toolsButtonIcon" alt="" />);
    }

    var count = this.props.count ? (<span className="connectionsCount">({this.props.count})</span>) : null;
    var url = Sefaria.util.replaceUrlParam("with", this.props.en);
    return (
      <a href={url} className="toolsButton sans noselect" onClick={this.onClick}>
        {icon}
        <span className="int-en noselect">{this.props.en} {count}</span>
        <span className="int-he noselect">{this.props.he} {count}</span>
      </a>)
  }
}

ToolsButton.propTypes = {
  en:      PropTypes.string.isRequired,
  he:      PropTypes.string.isRequired,
  icon:    PropTypes.string,
  image:   PropTypes.string,
  count:   PropTypes.number,
  onClick: PropTypes.func
};



class ShareBox extends Component {
  componentDidMount() {
    this.focusInput();
  }
  componentDidUpdate() {
    this.focusInput();
  }
  focusInput() {
    $(ReactDOM.findDOMNode(this)).find("input").select();
  }
  render() {
    var url = this.props.url;

    // Not quite working...
    // var fbButton = <iframe src={"https://www.facebook.com/plugins/share_button.php?href=" + encodeURIComponent(this.props.url) + '&layout=button&size=large&mobile_iframe=true&appId=206308089417064&width=73&height=28'} width="73" height="28" style={{border:"none", overflow: "hidden"}} scrolling="no" frameborder="0" allowTransparency="true"></iframe>

    var shareFacebook = function() {
      openInNewTab("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url));
    };
    var shareTwitter = function() {
      openInNewTab("https://twitter.com/home?status=" + url);
    };
    var shareEmail = function() {
      openInNewTab("mailto:?&subject=Text on Sefaria&body=" + url);
    };
    var classes = classNames({textList: 1, fullPanel: this.props.fullPanel});
    return (
      <div>
        <input className="shareInput" value={this.props.url} />
        <ToolsButton en="Facebook" he="פייסבוק" icon="facebook-official" onClick={shareFacebook} />
        <ToolsButton en="Twitter" he="טוויטר" icon="twitter" onClick={shareTwitter} />
        <ToolsButton en="Email" he="אימייל" icon="envelope-o" onClick={shareEmail} />
      </div>);
  }
}

ShareBox.propTypes = {
  url:                PropTypes.string.isRequired,
  setConnectionsMode: PropTypes.func.isRequired,
  closePanel:         PropTypes.func.isRequired,
  fullPanel:          PropTypes.bool
};



class AddToSourceSheetWindow extends Component {
  close () {
    if (this.props.close) {
      this.props.close();
    }
  }
  render () {
    var nextParam = "?next=" + encodeURIComponent(Sefaria.util.currentPath());

    return (<div className="addToSourceSheetModal">
      <div className="sourceSheetBoxTitle">
        <img src="/static/img/circled-x.svg" className="closeButton" aria-hidden="true" alt="Close" onClick={this.close}/>
        {Sefaria.loggedIn ? null : <span>
            In order to add this source to a sheet, please <a href={"/login" + nextParam}>log in.</a>
        </span>}
        <div className="clearFix"></div>
      </div>
      {Sefaria.loggedIn ?
        <AddToSourceSheetBox
          srefs = {this.props.srefs}
          en = {this.props.en}
          he = {this.props.he}
          note = {this.props.note}
        /> : null }
      </div>);
  }
}

AddToSourceSheetWindow.propTypes = {
  srefs:        PropTypes.array,
  close:        PropTypes.func,
  en:           PropTypes.string,
  he:           PropTypes.string,
  note:         PropTypes.string,
};


class AddToSourceSheetBox extends Component {
  // In the main app, the function `addToSourceSheet` is executed in the ReaderApp,
  // and collects the needed data from highlights and app state.
  // It is used in external apps, liked gardens.  In those cases, it's wrapped in AddToSourceSheetWindow,
  // refs and text are passed directly, and the add to source sheets API is invoked from within this object.
  constructor(props) {
    super(props);

    this.state = {
      sheetsLoaded: false,
      selectedSheet: null,
      sheetListOpen: false,
      showConfirm: false,
      showLogin: false,
    };
  }
  componentDidMount() {
    this.loadSheets();
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.setState({showConfirm: false});
    }
  }
  loadSheets() {
    if (!Sefaria._uid) {
      this.onSheetsLoad();
    } else {
      Sefaria.sheets.userSheets(Sefaria._uid, this.onSheetsLoad);
    }
  }
  onSheetsLoad() {
    this.setDefaultSheet();
    this.setState({sheetsLoaded: true});
  }
  setDefaultSheet() {
    if (this.state.selectedSheet) { return; }
    if (!Sefaria._uid) {
        this.setState({selectedSheet: {title: "Your Sheet"}});
    } else {
      var sheets = Sefaria.sheets.userSheets(Sefaria._uid);
      if (!sheets.length) {
        this.setState({selectedSheet: {title: "Create a New Sheet"}});
      } else {
        this.setState({selectedSheet: sheets[0]});
      }
    }
  }
  toggleSheetList() {
    if (!Sefaria._uid) {
      this.setState({showLogin: true});
    } else {
      this.setState({sheetListOpen: !this.state.sheetListOpen});
    }
  }
  selectSheet(sheet) {
    this.setState({selectedSheet: sheet, sheetListOpen: false});
  }
  addToSourceSheet() {
    if (!Sefaria._uid) { this.setState({showLogin: true}); }
    if (!this.state.selectedSheet || !this.state.selectedSheet.id) { return; }
    if (this.props.addToSourceSheet) {
      this.props.addToSourceSheet(this.state.selectedSheet.id, this.confirmAdd);
    } else {
      var url     = "/api/sheets/" + this.state.selectedSheet.id + "/add";
      var source = {};
      if (this.props.srefs) {
        source.refs = this.props.srefs;
        if (this.props.en) source.en = this.props.en;
        if (this.props.he) source.he = this.props.he;
      } else {
        if (this.props.en && this.props.he) {
          source.outsideBiText = {he: this.props.he, en: this.props.en};
        } else {
          source.outsideText = this.props.en || this.props.he;
        }
      }
      var postData = {source: JSON.stringify(source)};
      if (this.props.note) {
        postData.note = this.props.note;
      }
      $.post(url, postData, this.confirmAdd);
    }
  }
  createSheet(refs) {
    var title = $(ReactDOM.findDOMNode(this)).find("input").val();
    if (!title) { return; }
    var sheet = {
      title: title,
      options: {numbered: 0},
      sources: []
    };
    var postJSON = JSON.stringify(sheet);
    $.post("/api/sheets/", {"json": postJSON}, function(data) {
      Sefaria.sheets.clearUserSheets(Sefaria._uid);
      this.selectSheet(data);
    }.bind(this));
  }
  confirmAdd() {
    if (this.props.srefs) {
      Sefaria.site.track.event("Tools", "Add to Source Sheet Save", this.props.srefs.join("/"));
    } else {
      Sefaria.site.track.event("Tools", "Add to Source Sheet Save", "Outside Source");
    }
    this.setState({showConfirm: true});
  }
  render() {
    if (this.state.showConfirm) {
      return (<ConfirmAddToSheet sheetId={this.state.selectedSheet.id} />);
    } else if (this.state.showLogin) {
      return (<div className="addToSourceSheetBox sans">
                <LoginPrompt />
              </div>);
    }
    var sheets     = Sefaria._uid ? Sefaria.sheets.userSheets(Sefaria._uid) : null;
    var sheetsList = Sefaria._uid && sheets ? sheets.map(function(sheet) {
      var classes     = classNames({dropdownOption: 1, noselect: 1, selected: this.state.selectedSheet && this.state.selectedSheet.id == sheet.id});
      var title = sheet.title ? sheet.title.stripHtml() : "Untitled Source Sheet";
      var selectSheet = this.selectSheet.bind(this, sheet);
      return (<div className={classes} onClick={selectSheet} key={sheet.id}>{title}</div>);
    }.bind(this)) : (Sefaria._uid ? <LoadingMessage /> : null);

    // Uses
    return (
      <div className="addToSourceSheetBox noselect sans">
        <div className="dropdown">
          <div className="dropdownMain noselect" onClick={this.toggleSheetList}>
            <i className="dropdownOpenButton noselect fa fa-caret-down"></i>
            {this.state.sheetsLoaded ? this.state.selectedSheet.title.stripHtml() : <LoadingMessage messsage="Loading your sheets..." heMessage="טוען את דפי המקורות שלך"/>}
          </div>
          {this.state.sheetListOpen ?
          <div className="dropdownListBox noselect">
            <div className="dropdownList noselect">
              {sheetsList}
            </div>
            <div className="newSheet noselect">
              <input className="newSheetInput noselect" placeholder="Name New Sheet"/>
              <div className="button small noselect" onClick={this.createSheet} >
                <span className="int-en">Create</span>
                <span className="int-he">צור חדש</span>
              </div>
             </div>
          </div>
          : null}
        </div>
        <div className="button noselect fillWidth" onClick={this.addToSourceSheet}>
          <span className="int-en noselect">Add to Sheet</span>
          <span className="int-he noselect">הוסף לדף המקורות</span>
        </div>
      </div>);
  }
}

AddToSourceSheetBox.propTypes = {
  srefs:              PropTypes.array,
  addToSourceSheet:   PropTypes.func,
  fullPanel:          PropTypes.bool,
  en:                 PropTypes.string,
  he:                 PropTypes.string,
  note:               PropTypes.string
};


class ConfirmAddToSheet extends Component {
  render() {
    return (<div className="confirmAddToSheet addToSourceSheetBox">
              <div className="message">
                <span className="int-en">Your source has been added.</span>
                <span className="int-he">הטקסט נוסף בהצלחה לדף המקורות</span>
              </div>
              <a className="button white squareBorder" href={"/sheets/" + this.props.sheetId} target="_blank">
                <span className="int-en">Go to Source Sheet</span>
                <span className="int-he">עבור לדף המקורות</span>
              </a>
            </div>);
  }
}

ConfirmAddToSheet.propTypes = {
  sheetId: PropTypes.number.isRequired
};


class AddNoteBox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isPrivate: !props.noteIsPublic,
      saving: false
    };
  }
  componentDidMount() {
    this.focusNoteText();
  }
  focusNoteText() {
    $(ReactDOM.findDOMNode(this)).find(".noteText").focus();
  }
  saveNote() {
    var text = $(ReactDOM.findDOMNode(this)).find(".noteText").val();
    if (!text) { return; }
    var note = {
      text: text,
      refs: this.props.srefs,
      type:  "note",
      public: !this.state.isPrivate
    };
    var postData = { json: JSON.stringify(note) };
    var url = (this.props.noteId ? "/api/notes/" + this.props.noteId : "/api/notes/");
    $.post(url, postData, function(data) {
      if (data.error) {
        alert(data.error);
      } else if (data) {
        if (this.props.noteId) {
          Sefaria.clearPrivateNotes(data);
        } else {
          Sefaria.addPrivateNote(data);
        }
        Sefaria.site.track.event("Tools", "Note Save " + ((this.state.isPrivate)?"Private":"Public"), this.props.srefs.join("/"));
        $(ReactDOM.findDOMNode(this)).find(".noteText").val("");
        this.props.onSave();
      } else {
        alert("Sorry, there was a problem saving your note.");
      }
    }.bind(this)).fail( function(xhr, textStatus, errorThrown) {
      alert("Unfortunately, there was an error saving this note. Please try again or try reloading this page.");
    });
    this.setState({saving: true});
  }
  setPrivate() {
    this.setState({isPrivate: true});
  }
  setPublic() {
    this.setState({isPrivate: false});
  }
  deleteNote() {
    if (!confirm("Are you sure you want to delete this note?")) { return; }
    var url = "/api/notes/" + this.props.noteId;
    $.ajax({
      type: "delete",
      url: url,
      success: function() {
        Sefaria.clearPrivateNotes();
        Sefaria.site.track.event("Tools", "Delete Note", this.props.noteId);
        this.props.onDelete();
      }.bind(this),
      error: function() {
        alert("Something went wrong (that's all I know).");
      }
    });
  }
  render() {
    if (!Sefaria._uid) {
      return (<div className="addNoteBox"><LoginPrompt /></div>);
    }
    var privateClasses = classNames({notePrivateButton: 1, active: this.state.isPrivate});
    var publicClasses  = classNames({notePublicButton: 1, active: !this.state.isPrivate});
    return (
      <div className="addNoteBox">
        <textarea className="noteText" placeholder="Write a note..." defaultValue={this.props.noteText}></textarea>
        <div className="button fillWidth" onClick={this.saveNote}>
          <span className="int-en">{this.props.noteId ? "Save" : "Add Note"}</span>
          <span className="int-he">{this.props.noteId ? "שמור": "הוסף רשומה"}</span>
        </div>
        {this.props.noteId ?
          <div className="button white fillWidth" onClick={this.props.onCancel}>
            <span className="int-en">Cancel</span>
            <span className="int-he">בטל</span>
          </div> : null }
        {this.props.noteId ?
          (<div className="deleteNote" onClick={this.deleteNote}>
            <span className="int-en">Delete Note</span>
            <span className="int-he">מחק רשומה</span>
           </div>): null }
      </div>);

    /* Leaving out public / private toggle until public notes are reintroduced
    <div className="noteSharingToggle">
      <div className={privateClasses} onClick={this.setPrivate}>

        <span className="int-en"><i className="fa fa-lock"></i> Private</span>
        <span className="int-he"><i className="fa fa-lock"></i>רשומה פרטית</span>
      </div>
      <div className={publicClasses} onClick={this.setPublic}>
        <span className="int-en">Public</span>
        <span className="int-he">רשומה כללית</span>
      </div>
    </div>
    */
  }
}

AddNoteBox.propTypes = {
  srefs:          PropTypes.array.isRequired,
  onSave:         PropTypes.func.isRequired,
  onCancel:       PropTypes.func.isRequired,
  onDelete:       PropTypes.func,
  noteId:         PropTypes.string,
  noteText:       PropTypes.string,
  noteTitle:      PropTypes.string,
  noteIsPublic:   PropTypes.bool
};


class MyNotes extends Component {
  componentDidMount() {
    this.loadNotes();
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.loadNotes();
    }
  }
  loadNotes() {
    // Rerender this component when privateNotes arrive.
    Sefaria.privateNotes(this.props.srefs, this.rerender);
  }
  rerender() {
    this.forceUpdate();
  }
  render() {
    var myNotesData = Sefaria.privateNotes(this.props.srefs);
    var myNotes = myNotesData ? myNotesData.map(function(note) {
      var editNote = function() {
        this.props.editNote(note);
      }.bind(this);
      return (<Note
                text={note.text}
                isPrivate={!note.public}
                isMyNote={true}
                ownerName={note.ownerName}
                ownerProfileUrl={note.ownerProfileUrl}
                ownerImageUrl={note.ownerImageUrl}
                editNote={editNote}
                key={note._id} />);
    }.bind(this)) : null ;

    return myNotes ? (
      <div className="noteList myNoteList">
        {myNotes}
      </div>) : null;
  }
}

MyNotes.propTypes = {
  srefs:    PropTypes.array.isRequired,
  editNote: PropTypes.func.isRequired,
}


class PublicNotes extends Component {
  // List of Publc notes a ref or range or refs.
  render() {
    var notes   = Sefaria.notes(this.props.srefs);
    var content = notes ? notes.filter(function(note) {
      // Exlude my notes, shown already in MyNotes.
      return note.owner !== Sefaria._uid;
    }).map(function(note) {
      return (<Note
                text={note.text}
                ownerName={note.ownerName}
                ownerProfileUrl={note.ownerProfileUrl}
                ownerImageUrl={note.ownerImageUrl}
                isPrivate={false}
                key={note._id} />)
    }) : null;

    return content && content.length ? (<div className="noteList publicNoteList">{content}</div>) : null;
  }
}

PublicNotes.propTypes = {
  srefs: PropTypes.array.isRequired,
};


class Note extends Component {
  // Public or private note in the Sidebar.
  render() {
    var authorInfo = this.props.ownerName && !this.props.isMyNote ?
        (<div className="noteAuthorInfo">
          <a href={this.props.ownerProfileUrl}>
            <img className="noteAuthorImg" src={this.props.ownerImageUrl} />
          </a>
          <a href={this.props.ownerProfileUrl} className="noteAuthor">{this.props.ownerName}</a>
        </div>) : null;

      var buttons = this.props.isMyNote ?
                    (<div className="noteButtons">
                      <i className="editNoteButton fa fa-pencil" title="Edit Note" onClick={this.props.editNote} ></i>
                    </div>) : null;

      var text = Sefaria.util.linkify(this.props.text);
      text = text.replace(/\n/g, "<br />");

      return (<div className="note">
                {buttons}
                {authorInfo}
                <div className="noteContent">
                  <span className="noteText" dangerouslySetInnerHTML={{__html:text}}></span>
                </div>
              </div>);
  }
}

Note.propTypes = {
  text:            PropTypes.string.isRequired,
  ownerName:       PropTypes.string,
  ownerImageUrl:   PropTypes.string,
  ownerProfileUrl: PropTypes.string,
  isPrivate:       PropTypes.bool,
  isMyNote:        PropTypes.bool,
  editNote:        PropTypes.func
}


class AddConnectionBox extends Component {
  constructor(props) {
    super(props);
    this.state = { type: "" };
  }
  setType(type) {
    this.setState({type: type});
  }
  addConnection() {
    var connection = {
      refs: this.props.srefs,
      type: this.state.type,
    };
    var postData = { json: JSON.stringify(connection) };
    var url = "/api/links/";
    $.post(url, postData, function(data) {
      if (data.error) {
        alert(data.error);
      } else {
        Sefaria.site.track.event("Tools", "Add Connection", this.props.srefs.join("/"));
        Sefaria.clearLinks();
        this.props.onSave();
      }
    }.bind(this)).fail( function(xhr, textStatus, errorThrown) {
      alert("Unfortunately, there was an error saving this connection. Please try again or try reloading this page.");
    });
    this.setState({saving: true});
  }
  render() {
    var heRefs = this.props.srefs.map( ref =>  {
      var oRef = Sefaria.ref(ref);
      var heRef = oRef ? oRef.heRef : ref; // If a range was selected, the ref cache may not have a Hebrew ref for us
    });
    return (<div className="addConnectionBox">

            { this.props.srefs.length == 1 ?
              <div>
                <span className="int-en">Choose a text to connect.</span>
                <span className="int-he">בחר טקסט לקישור</span>

                <div className="button fillWidth" onClick={this.props.openComparePanel}>
                  <span className="int-en">Browse</span>
                  <span className="int-he">סייר</span>
                </div>
              </div>
              : null }

            { this.props.srefs.length > 2 ?
              <div>
                <span className="int-en">We currently only understand connections between two texts.</span>
                <span className="int-he">ניתן לקשר רק בין 2 טקסטים</span>
              </div>
              : null }

            { this.props.srefs.length == 2 ?
              <div>

                <div className="addConnectionSummary">
                  <span className="en">{ this.props.srefs[0] }<br/>&<br/>{ this.props.srefs[1]}</span>
                  <span className="he">{ heRefs[0] }<br/>&<br/>{ heRefs[1] }</span>
                </div>

                <Dropdown
                  options={[
                            {value: "",               label: "None"},
                            {value: "commentary",     label: "Commentary"},
                            {value: "quotation",      label: "Quotation"},
                            {value: "midrash",        label: "Midrash"},
                            {value: "ein mishpat",    label: "Ein Mishpat / Ner Mitsvah"},
                            {value: "mesorat hashas", label: "Mesorat HaShas"},
                            {value: "reference",      label: "Reference"},
                            {value: "related",        label: "Related Passage"}
                          ]}
                  placeholder={"Select Type"}
                  onSelect={this.setType} />

                <div className="button fillWidth" onClick={this.addConnection}>
                  <span className="int-en">Add Connection</span>
                  <span className="int-he">הוסף קישור</span>
                </div>

              </div>
              : null }

          </div>);
  }
}

AddConnectionBox.propTypes = {
  srefs:    PropTypes.array.isRequired,
  onSave:   PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};


class LoginPrompt extends Component {
  render() {
    var nextParam = "?next=" + Sefaria.util.currentPath();
    return (
      <div className="loginPrompt">
        <div className="loginPromptMessage">
          <span className="int-en">Please log in to use this feature.</span>
          <span className="int-he">עליך להיות מחובר בכדי להשתמש באפשרות זו.</span>
        </div>
        <a className="button" href={"/login" + nextParam}>
          <span className="int-en">Log In</span>
          <span className="int-he">התחבר</span>
        </a>
        <a className="button" href={"/register" + nextParam}>
          <span className="int-en">Sign Up</span>
          <span className="int-he">הרשם</span>
        </a>
      </div>);
  }
}

LoginPrompt.propTypes = {
  fullPanel: PropTypes.bool,
};


class SearchPage extends Component {
    constructor(props) {
      super(props);
      this.state = {};
    }
    render () {
        var fontSize = 62.5; // this.props.settings.fontSize, to make this respond to user setting. disabled for now.
        var style    = {"fontSize": fontSize + "%"};
        var classes  = classNames({readerNavMenu: 1, noHeader: this.props.hideNavHeader});
        var isQueryHebrew = Sefaria.hebrew.isHebrew(this.props.query);
        return (<div className={classes} key={this.props.query}>
                  {this.props.hideNavHeader ? null :
                    (<div className="readerNavTop search">
                      <CategoryColorLine category="Other" />
                      <ReaderNavigationMenuCloseButton onClick={this.props.close}/>
                      <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
                      <SearchBar
                        initialQuery = { this.props.query }
                        updateQuery = { this.props.onQueryChange } />
                    </div>)}
                  <div className="content hasFooter">
                    <div className="contentInner">
                      <div className="searchContentFrame">
                          <h1 className={classNames({"hebrewQuery": isQueryHebrew, "englishQuery": !isQueryHebrew})}>
                            &ldquo;{ this.props.query }&rdquo;
                          </h1>
                          <div className="searchControlsBox">
                          </div>
                          <div className="searchContent" style={style}>
                              <SearchResultList
                                  query = { this.props.query }
                                  appliedFilters = {this.props.appliedFilters}
                                  onResultClick={this.props.onResultClick}
                                  updateAppliedFilter = {this.props.updateAppliedFilter}
                                  updateAppliedOptionField={this.props.updateAppliedOptionField}
                                  updateAppliedOptionSort={this.props.updateAppliedOptionSort}
                                  registerAvailableFilters={this.props.registerAvailableFilters}
                                  availableFilters={this.props.availableFilters}
                                  filtersValid={this.props.filtersValid}
                                  exactField={this.props.exactField}
                                  broadField={this.props.broadField}
                                  field={this.props.field}
                                  sortType={this.props.sortType}/>
                          </div>
                      </div>
                    </div>
                    <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                      <Footer />
                    </footer>
                  </div>
                </div>);
    }
}

SearchPage.propTypes = {
    query:                PropTypes.string,
    appliedFilters:       PropTypes.array,
    settings:             PropTypes.object,
    close:                PropTypes.func,
    onResultClick:        PropTypes.func,
    onQueryChange:        PropTypes.func,
    updateAppliedFilter:  PropTypes.func,
    updateAppliedOptionField: PropTypes.func,
    updateAppliedOptionSort:  PropTypes.func,
    registerAvailableFilters: PropTypes.func,
    availableFilters:     PropTypes.array,
    filtersValid:         PropTypes.bool,
    hideNavHeader:        PropTypes.bool,
    exactField:           PropTypes.string,
    broadField:           PropTypes.string,
    field:                PropTypes.string,
    sortType:             PropTypes.oneOf(["relevance","chronological"])
};

SearchPage.defaultProps = {
  appliedFilters: []
};


class SearchBar extends Component {
    constructor(props) {
      super(props);

      this.state = {query: props.initialQuery};
    }
    handleKeypress(event) {
        if (event.charCode == 13) {
            this.updateQuery();
            // Blur search input to close keyboard
            $(ReactDOM.findDOMNode(this)).find(".readerSearch").blur();
        }
    }
    updateQuery() {
        if (this.props.updateQuery) {
            this.props.updateQuery(this.state.query)
        }
    }
    handleChange(event) {
        this.setState({query: event.target.value});
    }
    render () {
        return (
            <div>
                <div className="searchBox">
                    <input className="readerSearch" id="searchInput" title="Search for Texts or Keywords Here" value={this.state.query} onKeyPress={this.handleKeypress} onChange={this.handleChange} placeholder="Search"/>
                    <ReaderNavigationMenuSearchButton onClick={this.updateQuery} />
                </div>
                <div className="description"></div>
            </div>
        )
    }
}

SearchBar.propTypes = {
    initialQuery: PropTypes.string,
    updateQuery: PropTypes.func
};


class SearchResultList extends Component {
    constructor(props) {
        super(props);

        this.initialQuerySize = 100,
        this.backgroundQuerySize = 1000,
        this.maxResultSize = 10000,
        this.resultDisplayStep = 50,
        this.state = {
            types: ["text", "sheet"],
            runningQueries: {"text": null, "sheet": null},
            isQueryRunning: {"text": false, "sheet": false},
            moreToLoad: {"text": true, "sheet": true},
            totals: {"text":0, "sheet":0},
            displayedUntil: {"text":50, "sheet":50},
            hits: {"text": [], "sheet": []},
            activeTab: "text",
            error: false,
            showOverlay: false,
            displayFilters: false,
            displaySort: false
        }
    }
    updateRunningQuery(type, ajax, isLoadingRemainder) {
        this.state.runningQueries[type] = ajax;
        this.state.isQueryRunning[type] = !!ajax && !isLoadingRemainder;
        this.setState({
          runningQueries: this.state.runningQueries,
          isQueryRunning: this.state.isQueryRunning
        });
    }
    _abortRunningQueries() {
        this.state.types.forEach(t => this._abortRunningQuery(t));
    }
    _abortRunningQuery(type) {
        if(this.state.runningQueries[type]) {
            this.state.runningQueries[type].abort();
        }
        this.updateRunningQuery(type, null, false);
    }
    componentDidMount() {
        this._executeQueries();
        $(ReactDOM.findDOMNode(this)).closest(".content").bind("scroll", this.handleScroll);
    }
    componentWillUnmount() {
        this._abortRunningQueries();
        $(ReactDOM.findDOMNode(this)).closest(".content").unbind("scroll", this.handleScroll);
    }
    handleScroll() {
      var tab = this.state.activeTab;
      if (this.state.displayedUntil[tab] >= this.state.totals[tab]) { return; }
      var $scrollable = $(ReactDOM.findDOMNode(this)).closest(".content");
      var margin = 100;
      if($scrollable.scrollTop() + $scrollable.innerHeight() + margin >= $scrollable[0].scrollHeight) {
        this._extendResultsDisplayed();
      }
    }
    _extendResultsDisplayed() {
      var tab = this.state.activeTab;
      this.state.displayedUntil[tab] += this.resultDisplayStep;
      if (this.state.displayedUntil[tab] >= this.state.totals[tab]) {
        this.state.displayedUntil[tab] = this.state.totals[tab];
      }
      this.setState({displayedUntil: this.state.displayedUntil});
    }
    componentWillReceiveProps(newProps) {
        if(this.props.query != newProps.query) {
           this.setState({
             totals: {"text":0, "sheet":0},
             hits: {"text": [], "sheet": []},
             moreToLoad: {"text": true, "sheet": true},
             displayedUntil: {"text":50, "sheet":50},
             displayFilters: false,
             displaySort: false,
             showOverlay: false
           });
           this._executeQueries(newProps)
        }
        else if (
        (this.props.appliedFilters.length !== newProps.appliedFilters.length) ||
          !(this.props.appliedFilters.every((v,i) => v === newProps.appliedFilters[i]))) {
           this._executeQueries(newProps)
        }
        // Execute a second query to apply filters after an initial query which got available filters
        else if ((this.props.filtersValid != newProps.filtersValid) && this.props.appliedFilters.length > 0) {
           this._executeQueries(newProps);
        }
        else if (this.props.field != newProps.field || this.props.sortType != newProps.sortType) {
          this._executeQueries(newProps);
        }
    }
    _loadRemainder(type, last, total, currentHits) {
    // Having loaded "last" results, and with "total" results to load, load the rest, this.backgroundQuerySize at a time
      if (last >= total || last >= this.maxResultSize) {
        this.updateRunningQuery(type, null, false);
        this.state.moreToLoad[type] = false;
        this.setState({moreToLoad: this.state.moreToLoad});
        return;
      }

      var querySize = this.backgroundQuerySize;
      if (last + querySize > this.maxResultSize) {
        querySize = this.maxResultSize - last;
      }

      var field = "content";
      if (type == "text") {
        field = this.props.field;
      }
      var query_props = {
        query: this.props.query,
        type: type,
        size: querySize,
        from: last,
        field: field,
        sort_type: this.props.sortType,
        exact: this.props.exactField === this.props.field,
        error: function() {  console.log("Failure in SearchResultList._loadRemainder"); },
        success: function(data) {
          var nextHits = currentHits.concat(data.hits.hits);
          if (type === "text") {
            nextHits = this._process_text_hits(nextHits);
          }

          this.state.hits[type] = nextHits;

          this.setState({hits: this.state.hits});
          this._loadRemainder(type, last + this.backgroundQuerySize, total, nextHits);
        }.bind(this)
      };
      if (type == "text") {
        extend(query_props, {
          get_filters: false,
          applied_filters: this.props.appliedFilters
        });
      }

      var runningLoadRemainderQuery = Sefaria.search.execute_query(query_props);
      this.updateRunningQuery(type, runningLoadRemainderQuery, true);
    }
    _executeQueries(props) {
        //This takes a props object, so as to be able to handle being called from componentWillReceiveProps with newProps
        props = props || this.props;
        if (!props.query) {
            return;
        }

        this._abortRunningQueries();

        // If there are no available filters yet, don't apply filters.  Split into two queries:
        // 1) Get all potential filters and counts
        // 2) Apply filters (Triggered from componentWillReceiveProps)
        var request_applied = props.filtersValid && props.appliedFilters;
        var isCompletionStep = !!request_applied || props.appliedFilters.length == 0;

        var runningSheetQuery = Sefaria.search.execute_query({
            query: props.query,
            type: "sheet",
            size: this.initialQuerySize,
            field: "content",
            sort_type: "chronological",
            exact: true,
            success: function(data) {
                this.updateRunningQuery("sheet", null, false);
                  this.setState({
                    hits: extend(this.state.hits, {"sheet": data.hits.hits}),
                    totals: extend(this.state.totals, {"sheet": data.hits.total})
                  });
                  Sefaria.site.track.event("Search", "Query: sheet", props.query, data.hits.total);

                if(isCompletionStep) {
                  this._loadRemainder("sheet", this.initialQuerySize, data.hits.total, data.hits.hits);
                }

            }.bind(this),
            error: this._handle_error
        });

        var runningTextQuery = Sefaria.search.execute_query({
            query: props.query,
            type: "text",
            get_filters: !props.filtersValid,
            applied_filters: request_applied,
            size: this.initialQuerySize,
            field: props.field,
            sort_type: props.sortType,
            exact: props.exactField === props.field,
            success: function(data) {
                this.updateRunningQuery("text", null, false);
                var hitArray = this._process_text_hits(data.hits.hits);
                this.setState({
                  hits: extend(this.state.hits, {"text": hitArray}),
                  totals: extend(this.state.totals, {"text": data.hits.total})
                });
                var filter_label = (request_applied && request_applied.length > 0)? (" - " + request_applied.join("|")) : "";
                var query_label = props.query + filter_label;
                Sefaria.site.track.event("Search", "Query: text", query_label, data.hits.total);
                if (data.aggregations) {
                  if (data.aggregations.category) {
                    var ftree = this._buildFilterTree(data.aggregations.category.buckets);
                    var orphans = this._applyFilters(ftree, this.props.appliedFilters);
                    this.props.registerAvailableFilters(ftree.availableFilters, ftree.registry, orphans);
                  }
                }
                if(isCompletionStep) {
                  this._loadRemainder("text", this.initialQuerySize, data.hits.total, hitArray);
                }
            }.bind(this),
            error: this._handle_error
        });

        this.updateRunningQuery("text", runningTextQuery, false);
        this.updateRunningQuery("sheet", runningSheetQuery, false);
    }
    _handle_error(jqXHR, textStatus, errorThrown) {
        if (textStatus == "abort") {
            // Abort is immediately followed by new query, above.  Worried there would be a race if we call updateCurrentQuery(null) from here
            //this.updateCurrentQuery(null);
            return;
        }
        this.setState({error: true});
        this.updateRunningQuery(null, null, false);
    }
    _process_text_hits(hits) {
      var newHits = [];
      var newHitsObj = {};  // map ref -> index in newHits
      for (var i = 0; i < hits.length; i++) {
        let currRef = hits[i]._source.ref;
        let newHitsIndex = newHitsObj[currRef];
        if (typeof newHitsIndex != "undefined") {
          newHits[newHitsIndex].duplicates = newHits[newHitsIndex].duplicates || [];
          newHits[newHitsIndex].duplicates.push(hits[i]);
        } else {
          newHits.push(hits[i])
          newHitsObj[currRef] = newHits.length - 1;
        }
      }
      return newHits;
    }
    _buildFilterTree(aggregation_buckets) {
      //returns object w/ keys 'availableFilters', 'registry'
      //Add already applied filters w/ empty doc count?
      var rawTree = {};

      this.props.appliedFilters.forEach(
          fkey => this._addAvailableFilter(rawTree, fkey, {"docCount":0})
      );

      aggregation_buckets.forEach(
          f => this._addAvailableFilter(rawTree, f["key"], {"docCount":f["doc_count"]})
      );
      this._aggregate(rawTree);
      return this._build(rawTree);
    }
    _addAvailableFilter(rawTree, key, data) {
      //key is a '/' separated key list, data is an arbitrary object
      //Based on http://stackoverflow.com/a/11433067/213042
      var keys = key.split("/");
      var base = rawTree;

      // If a value is given, remove the last name and keep it for later:
      var lastName = arguments.length === 3 ? keys.pop() : false;

      // Walk the hierarchy, creating new objects where needed.
      // If the lastName was removed, then the last object is not set yet:
      var i;
      for(i = 0; i < keys.length; i++ ) {
          base = base[ keys[i] ] = base[ keys[i] ] || {};
      }

      // If a value was given, set it to the last name:
      if( lastName ) {
          base = base[ lastName ] = data;
      }

      // Could return the last object in the hierarchy.
      // return base;
    }
    _aggregate(rawTree) {
      //Iterates the raw tree to aggregate doc_counts from the bottom up
      //Nod to http://stackoverflow.com/a/17546800/213042
      walker("", rawTree);
      function walker(key, branch) {
          if (branch !== null && typeof branch === "object") {
              // Recurse into children
              $.each(branch, walker);
              // Do the summation with a hacked object 'reduce'
              if ((!("docCount" in branch)) || (branch["docCount"] === 0)) {
                  branch["docCount"] = Object.keys(branch).reduce(function (previous, key) {
                      if (typeof branch[key] === "object" && "docCount" in branch[key]) {
                          previous += branch[key].docCount;
                      }
                      return previous;
                  }, 0);
              }
          }
      }
    }
    _build(rawTree) {
      //returns dict w/ keys 'availableFilters', 'registry'
      //Aggregate counts, then sort rawTree into filter objects and add Hebrew using Sefaria.toc as reference
      //Nod to http://stackoverflow.com/a/17546800/213042
      var path = [];
      var filters = [];
      var registry = {};

      var commentaryNode = new Sefaria.search.FilterNode();


      for(var j = 0; j < Sefaria.search_toc.length; j++) {
          var b = walk.call(this, Sefaria.search_toc[j]);
          if (b) filters.push(b);

          // Remove after commentary refactor ?
          // If there is commentary on this node, add it as a sibling
          if (commentaryNode.hasChildren()) {
            var toc_branch = Sefaria.toc[j];
            var cat = toc_branch["category"];
            // Append commentary node to result filters, add a fresh one for the next round
            var docCount = 0;
            if (rawTree.Commentary && rawTree.Commentary[cat]) { docCount += rawTree.Commentary[cat].docCount; }
            if (rawTree.Commentary2 && rawTree.Commentary2[cat]) { docCount += rawTree.Commentary2[cat].docCount; }
            extend(commentaryNode, {
                "title": cat + " Commentary",
                "path": "Commentary/" + cat,
                "heTitle": "מפרשי" + " " + toc_branch["heCategory"],
                "docCount": docCount
            });
            registry[commentaryNode.path] = commentaryNode;
            filters.push(commentaryNode);
            commentaryNode = new Sefaria.search.FilterNode();
          }
      }

      return {availableFilters: filters, registry: registry};

      function walk(branch, parentNode) {
          var node = new Sefaria.search.FilterNode();

          node["docCount"] = 0;

          if("category" in branch) { // Category node

            path.push(branch["category"]);  // Place this category at the *end* of the path
            extend(node, {
              "title": path.slice(-1)[0],
              "path": path.join("/"),
              "heTitle": branch["heCategory"]
            });

            for(var j = 0; j < branch["contents"].length; j++) {
                var b = walk.call(this, branch["contents"][j], node);
                if (b) node.append(b);
            }
          }
          else if ("title" in branch) { // Text Node
              path.push(branch["title"]);
              extend(node, {
                 "title": path.slice(-1)[0],
                 "path": path.join("/"),
                 "heTitle": branch["heTitle"]
              });
          }

          try {
              var rawNode = rawTree;
              var i;

              for (i = 0; i < path.length; i++) {
                //For TOC nodes that we don't have results for, we catch the exception below.
                rawNode = rawNode[path[i]];
              }
              node["docCount"] += rawNode.docCount;


              // Do we need both of these in the registry?
              registry[node.getId()] = node;
              registry[node.path] = node;

              path.pop();
              return node;
          }
          catch (e) {
            path.pop();
            return false;
          }
      }
    }
    _applyFilters(ftree, appliedFilters) {
      var orphans = [];  // todo: confirm behavior
      appliedFilters.forEach(path => {
        var node = ftree.registry[path];
        if (node) { node.setSelected(true); }
        else { orphans.push(path); }
      });
      return orphans;
    }
    showSheets() {
      this.setState({"activeTab": "sheet"});
    }
    showTexts() {
      this.setState({"activeTab": "text"});
    }
    showResultsOverlay(shouldShow) {
      //overlay gives opacity to results when either filter box or sort box is open
      this.setState({showOverlay: shouldShow});
    }
    toggleFilterView() {
      this.showResultsOverlay(!this.state.displayFilters);
      this.setState({displayFilters: !this.state.displayFilters, displaySort: false});
    }
    toggleSortView() {
      this.showResultsOverlay(!this.state.displaySort);
      this.setState({displaySort: !this.state.displaySort, displayFilters: false});
    }
    closeFilterView() {
      this.showResultsOverlay(false);
      this.setState({displayFilters: false});
    }
    closeSortView() {
      this.showResultsOverlay(false);
      this.setState({displaySort: false});
    }
    render () {
        if (!(this.props.query)) {  // Push this up? Thought is to choose on the SearchPage level whether to show a ResultList or an EmptySearchMessage.
            return null;
        }

        var tab = this.state.activeTab;
        var results = [];

        if (tab == "text") {
          results = this.state.hits.text.slice(0,this.state.displayedUntil["text"]).filter(result => !!result._source.version).map(result =>
            <SearchTextResult
                data={result}
                query={this.props.query}
                key={result._id}
                onResultClick={this.props.onResultClick} />);

        } else if (tab == "sheet") {
          results = this.state.hits.sheet.slice(0, this.state.displayedUntil["sheet"]).map(result =>
              <SearchSheetResult
                    data={result}
                    query={this.props.query}
                    key={result._id} />);
        }

        var loadingMessage   = (<LoadingMessage message="Searching..." heMessage="מבצע חיפוש..." />);
        var noResultsMessage = (<LoadingMessage message="0 results." heMessage="0 תוצאות." />);

        var queryFullyLoaded      = !this.state.moreToLoad[tab] && !this.state.isQueryRunning[tab];
        var haveResults      = !!results.length;
        results              = haveResults ? results : noResultsMessage;
        var searchFilters    = (<SearchFilters
                                  query = {this.props.query}
                                  total = {this.state.totals["text"] + this.state.totals["sheet"]}
                                  textTotal = {this.state.totals["text"]}
                                  sheetTotal = {this.state.totals["sheet"]}
                                  availableFilters={this.props.availableFilters}
                                  appliedFilters = {this.props.appliedFilters}
                                  updateAppliedFilter = {this.props.updateAppliedFilter}
                                  updateAppliedOptionField = {this.props.updateAppliedOptionField}
                                  updateAppliedOptionSort = {this.props.updateAppliedOptionSort}
                                  exactField = {this.props.exactField}
                                  broadField = {this.props.broadField}
                                  optionField = {this.props.field}
                                  sortType = {this.props.sortType}
                                  isQueryRunning = {this.state.isQueryRunning[tab]}
                                  activeTab = {this.state.activeTab}
                                  clickTextButton = {this.showTexts}
                                  clickSheetButton = {this.showSheets}
                                  showResultsOverlay = {this.showResultsOverlay}
                                  displayFilters={this.state.displayFilters}
                                  displaySort={this.state.displaySort}
                                  toggleFilterView={this.toggleFilterView}
                                  toggleSortView={this.toggleSortView}
                                  closeFilterView={this.closeFilterView}
                                  closeSortView={this.closeSortView}/>);
        return (
          <div>
            { searchFilters }
            <div className={this.state.showOverlay ? "searchResultsOverlay" : ""}>
              { queryFullyLoaded || haveResults ? results : loadingMessage }
            </div>
          </div>
        );
    }
}

SearchResultList.propTypes = {
  query:                PropTypes.string,
  appliedFilters:       PropTypes.array,
  onResultClick:        PropTypes.func,
  filtersValid:         PropTypes.bool,
  availableFilters:     PropTypes.array,
  updateAppliedFilter:  PropTypes.func,
  updateAppliedOptionField: PropTypes.func,
  updateAppliedOptionSort:  PropTypes.func,
  exactField:           PropTypes.string,
  broadField:           PropTypes.string,
  field:                PropTypes.string,
  sortType:            PropTypes.oneOf(["relevance", "chronological"]),
  registerAvailableFilters: PropTypes.func
};

SearchResultList.defaultProps = {
  appliedFilters: []
};


class SearchFilters extends Component {
  constructor(props) {
    super(props);

    this.state = {
      openedCategory: null,
      openedCategoryBooks: [],
      isExactSearch: props.optionField === props.exactField
    }
  }

  componentWillReceiveProps(newProps) {
    // Save current filters
    // this.props
    // todo: check for cases when we want to rebuild / not

    if ((newProps.query != this.props.query)
        || (newProps.availableFilters.length == 0)) {

      this.setState({
        openedCategory: null,
        openedCategoryBooks: [],
        isExactSearch: this.props.optionField === this.props.exactField
      });
    }
    // todo: logically, we should be unapplying filters as well.
    // Because we compute filter removal from teh same object, this ends up sliding in messily in the setState.
    // Hard to see how to get it through the front door.
      //if (this.state.openedCategory) {
      //   debugger;
      // }
     /*
   if (newProps.appliedFilters &&
              ((newProps.appliedFilters.length !== this.props.appliedFilters.length)
               || !(newProps.appliedFilters.every((v,i) => v === this.props.appliedFilters[i]))
              )
            ) {
      if (this.state.openedCategory) {
        this.handleFocusCategory(this.state.openedCategory);
      }
    } */
  }
  getSelectedTitles(lang) {
    var results = [];
    for (var i = 0; i < this.props.availableFilters.length; i++) {
        results = results.concat(this.props.availableFilters[i].getSelectedTitles(lang));
    }
    return results;
  }
  handleFocusCategory(filterNode) {
    var leaves = filterNode.getLeafNodes();
    this.setState({
      openedCategory: filterNode,
      openedCategoryBooks: leaves
    })
  }
  toggleExactSearch() {
    let newExactSearch = !this.state.isExactSearch;
    if (newExactSearch) {
      this.props.updateAppliedOptionField(this.props.exactField);
    } else {
      this.props.updateAppliedOptionField(this.props.broadField);
    }
    this.setState({isExactSearch: newExactSearch});

  }
  _type_button(en_singular, en_plural, he_singular, he_plural, total, on_click, active) {
    // if (!total) { return "" }
      var total_with_commas = this._add_commas(total);
      var classes = classNames({"type-button": 1, active: active});

      return <div className={classes} onClick={on_click}>
      <div className="type-button-total">
        {total_with_commas}
      </div>
      <div className="type-button-title">
        <span className="int-en">{(total != 1) ? en_plural : en_singular}</span>
        <span className="int-he">{(total != 1) ? he_plural : he_singular}</span>
      </div>
    </div>;
  }
  _add_commas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  render() {

    var runningQueryLine = (<LoadingMessage message="Searching..." heMessage="מבצע חיפוש..." />);

    var buttons = (
      <div className="type-buttons">
        {this._type_button("Text", "Texts", "מקור", "מקורות", this.props.textTotal, this.props.clickTextButton, (this.props.activeTab == "text"))}
        {this._type_button("Sheet", "Sheets", "דף מקורות", "דפי מקורות", this.props.sheetTotal, this.props.clickSheetButton, (this.props.activeTab == "sheet"))}
      </div>
    );

    var selected_filters = (<div className="results-count">
          <span className="int-en">
            {(!!this.props.appliedFilters.length && !!this.props.total)?(this.getSelectedTitles("en").join(", ")):""}
          </span>
          <span className="int-he">
            {(!!this.props.appliedFilters.length && !!this.props.total)?(this.getSelectedTitles("he").join(", ")):""}
          </span>
      </div>);
    var filter_panel = (<SearchFilterPanel
        toggleFilterView={this.props.toggleFilterView}
        toggleExactSearch={this.toggleExactSearch}
        displayFilters={this.props.displayFilters}
        availableFilters={this.props.availableFilters}
        openedCategory={this.state.openedCategory}
        openedCategoryBooks={this.state.openedCategoryBooks}
        updateAppliedFilter={this.props.updateAppliedFilter}
        query={this.props.query}
        closeBox={this.props.closeFilterView}
        isExactSearch={this.props.exactField === this.props.optionField}
        handleFocusCategory={this.handleFocusCategory}
    />);

    var sort_panel = (<SearchSortBox
          visible={this.props.displaySort}
          toggleSortView={this.props.toggleSortView}
          updateAppliedOptionSort={this.props.updateAppliedOptionSort}
          closeBox={this.props.closeSortView}
          sortType={this.props.sortType}/>);
    return (
      <div className={ classNames({searchTopMatter: 1, loading: this.props.isQueryRunning}) }>
        <div className="searchStatusLine">
          { (this.props.isQueryRunning) ? runningQueryLine : buttons }
          { (this.props.availableFilters.length > 0 && this.props.activeTab == "text") ? selected_filters : ""}
        </div>
        { ((true || this.props.availableFilters.length > 0) && this.props.activeTab == "text") ?
            (<div className="filterSortFlexbox">
              {filter_panel}
              {sort_panel}
            </div>)
            : "" }
      </div>);
  }
}

SearchFilters.propTypes = {
  query:                PropTypes.string,
  total:                PropTypes.number,
  textTotal:            PropTypes.number,
  sheetTotal:           PropTypes.number,
  appliedFilters:       PropTypes.array,
  availableFilters:     PropTypes.array,
  updateAppliedFilter:  PropTypes.func,
  updateAppliedOptionField: PropTypes.func,
  updateAppliedOptionSort: PropTypes.func,
  exactField:           PropTypes.string,
  broadField:           PropTypes.string,
  optionField:          PropTypes.string,
  sortType:             PropTypes.string,
  isQueryRunning:       PropTypes.bool,
  activeTab:            PropTypes.string,
  clickTextButton:      PropTypes.func,
  clickSheetButton:     PropTypes.func,
  showResultsOverlay:   PropTypes.func,
  displayFilters:       PropTypes.bool,
  displaySort:          PropTypes.bool,
  toggleFilterView:     PropTypes.func,
  toggleSortView:       PropTypes.func,
  closeFilterView:      PropTypes.func,
  closeSortView:        PropTypes.func
};

SearchFilters.defaultProps = {
  appliedFilters: [],
  availableFilters: []
};


class SearchFilterPanel extends Component {
  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }
  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }
  handleClickOutside(event) {
    const domNode = ReactDOM.findDOMNode(this);
    if ((!domNode || !domNode.contains(event.target)) && this.props.displayFilters) {
      this.props.closeBox();
    }
  }
  render() {
    return (<div>
      <div className="searchFilterToggle" onClick={this.props.toggleFilterView}>
        <span className="int-en">Filter</span>
        <span className="int-he">סינון</span>
        {(this.props.displayFilters) ? <img src="/static/img/arrow-up.png" alt=""/> : <img src="/static/img/arrow-down.png" alt=""/>}
      </div>
      <div className={(this.props.displayFilters) ? "searchFilterBoxes":"searchFilterBoxes hidden"}>
        <div className="searchFilterBoxRow">
          <div className="searchFilterCategoryBox">
          {this.props.availableFilters.map(function(filter) {
              return (<SearchFilter
                  filter={filter}
                  isInFocus={this.props.openedCategory === filter}
                  focusCategory={this.props.handleFocusCategory}
                  updateSelected={this.props.updateAppliedFilter}
                  key={filter.path}/>);
          }.bind(this))}
          </div>
          <div className="searchFilterBookBox">
          {this.props.openedCategoryBooks.map(function(filter) {
              return (<SearchFilter
                  filter={filter}
                  updateSelected={this.props.updateAppliedFilter}
                  key={filter.path}/>);
          }.bind(this))}
          </div>
        </div>
        <div className={"searchFilterExactBox"}>
          <SearchFilterExactBox
            selected={this.props.isExactSearch}
            checkBoxClick={this.props.toggleExactSearch}
            />
        </div>
        <div style={{clear: "both"}}/>
      </div>
    </div>);
  }
}

SearchFilterPanel.propTypes = {
  toggleFilterView:    PropTypes.func,
  displayFilters:      PropTypes.bool,
  availableFilters:    PropTypes.array,
  openedCategory:      PropTypes.object,
  updateAppliedFilter: PropTypes.func,
  openedCategoryBooks: PropTypes.array,
  query:               PropTypes.string,
  isExactSearch:       PropTypes.bool,
  toggleExactSearch:   PropTypes.func,
  closeBox:            PropTypes.func,
  handleFocusCategory: PropTypes.func
};


class SearchSortBox extends Component {
  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }
  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }
  handleClickOutside(event) {
    const domNode = ReactDOM.findDOMNode(this);

    if ((!domNode || !domNode.contains(event.target)) && this.props.visible) {
      this.props.closeBox();
    }
  }
  handleClick(sortType) {
    if (sortType === this.props.sortType) {
      return;
    }
    if (this.props.sortType === "chronological") {
      this.props.updateAppliedOptionSort("relevance");
    } else {
      this.props.updateAppliedOptionSort("chronological");
    }
    this.props.toggleSortView();
  }
  //<i className={(this.props.visible) ? "fa fa-caret-down fa-angle-down":"fa fa-caret-down fa-angle-up"} />
  render() {
    var chronoClass = classNames({'filter-title': 1, 'unselected': this.props.sortType !== "chronological"});
    var releClass = classNames({'filter-title': 1, 'unselected': this.props.sortType !== "relevance"});
    return (<div>
      <div className="searchFilterToggle" onClick={this.props.toggleSortView}>
        <span className="int-en">Sort</span>
        <span className="int-he">מיון</span>
        {(this.props.visible) ? <img src="/static/img/arrow-up.png" alt=""/> : <img src="/static/img/arrow-down.png" alt=""/>}

      </div>
      <div className={(this.props.visible) ? "searchSortBox" :"searchSortBox hidden"}>
        <table>
          <tbody>
            <tr  className={releClass} onClick={()=>this.handleClick("relevance")}>
              <td>
                <img className="searchSortCheck" src="/static/img/check-mark.svg" alt="relevance sort selected"/>
              </td>
              <td>
                <span className="int-en">{"Relevance"}</span>
                <span className="int-he" dir="rtl">{"רלוונטיות"}</span>
              </td>
            </tr>
            <tr className={chronoClass} onClick={()=>this.handleClick("chronological")}>
              <td>
                <img className="searchSortCheck" src="/static/img/check-mark.svg" alt="chronological sort selected"/>
              </td>
              <td>
                <span className="int-en">{"Chronological"}</span>
                <span className="int-he" dir="rtl">{"כרונולוגי"}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>);
  }
}

SearchSortBox.propTypes = {
  visible:                 PropTypes.bool,
  toggleSortView:          PropTypes.func,
  updateAppliedOptionSort: PropTypes.func,
  closeBox:                PropTypes.func,
  sortType:                PropTypes.oneOf(["chronological", "relevance"])
};


class SearchFilterExactBox extends Component {
  handleClick() {
    this.props.checkBoxClick();
  }
  render() {
    return (<li>
      <input type="checkbox" id="searchFilterExactBox" className="filter" checked={this.props.selected} onChange={this.handleClick}/>
      <label onClick={this.handleClick}><span></span></label>
      <span className="int-en"><span className="filter-title">{"Exact search"}</span></span>
      <span className="int-he" dir="rtl"><span className="filter-title">{"חיפוש מדויק"}</span></span>
    </li>);
  }
}

SearchFilterExactBox.propTypes = {
  selected:      PropTypes.bool,
  checkBoxClick: PropTypes.func
};


class SearchFilter extends Component {
  constructor(props) {
    super(props);

    this.state = {selected: props.filter.selected};
  }
  componentWillReceiveProps(newProps) {
    if (newProps.filter.selected != this.state.selected) {
      this.setState({selected: newProps.filter.selected});
    }
  }
  // Can't set indeterminate in the render phase.  https://github.com/facebook/react/issues/1798
  componentDidMount() {
    ReactDOM.findDOMNode(this).querySelector("input").indeterminate = this.props.filter.isPartial();
  }
  componentDidUpdate() {
    ReactDOM.findDOMNode(this).querySelector("input").indeterminate = this.props.filter.isPartial();
  }
  handleFilterClick(evt) {
    //evt.preventDefault();
    this.props.updateSelected(this.props.filter)
  }
  handleFocusCategory() {
    if (this.props.focusCategory) {
      this.props.focusCategory(this.props.filter)
    }
  }
  render() {
    return(
      <li onClick={this.handleFocusCategory}>
        <input type="checkbox" id={this.props.filter.path} className="filter" checked={this.state.selected == 1} onChange={this.handleFilterClick}/>
        <label onClick={this.handleFilterClick}><span></span></label>
        <span className="int-en"><span className="filter-title">{this.props.filter.title}</span> <span className="filter-count">({this.props.filter.docCount})</span></span>
        <span className="int-he" dir="rtl"><span className="filter-title">{this.props.filter.heTitle}</span> <span className="filter-count">({this.props.filter.docCount})</span></span>
        {this.props.isInFocus?<span className="int-en"><i className="in-focus-arrow fa fa-caret-right"/></span>:""}
        {this.props.isInFocus?<span className="int-he"><i className="in-focus-arrow fa fa-caret-left"/></span>:""}
      </li>);
  }
}

SearchFilter.propTypes = {
  filter:         PropTypes.object.isRequired,
  isInFocus:      PropTypes.bool,
  updateSelected: PropTypes.func.isRequired,
  focusCategory:  PropTypes.func
};


class SearchTextResult extends Component {
    constructor(props) {
        super(props);

        this.state = {
            duplicatesShown: false
        };
    }
    toggleDuplicates(event) {
        this.setState({
            duplicatesShown: !this.state.duplicatesShown
        });
    }
    handleResultClick(event) {
        if(this.props.onResultClick) {
            event.preventDefault();
            var s = this.props.data._source;
            Sefaria.site.track.event("Search", "Search Result Text Click", `${this.props.query} - ${s.ref}/${s.version}/${s.lang}`);
            this.props.onResultClick(s.ref, s.version, s.lang, {"highlight": this.props.query}); //highlight not yet handled, above in ReaderApp.handleNavigationClick()
        }
    }
    render () {
        var data = this.props.data;
        var s = this.props.data._source;
        var href = '/' + Sefaria.normRef(s.ref) + "/" + s.lang + "/" + s.version.replace(/ +/g, "_") + '?qh=' + this.props.query;

        function get_snippet_markup() {
            var snippet;
            var field = Object.keys(data.highlight)[0]; //there should only be one key
            // if (data.highlight && data.highlight[field]) {
            snippet = data.highlight[field].join("...");
            // } else {
            //     snippet = s[field];  // We're filtering out content, because it's *huge*, especially on Sheets
            // }
            let dir = Sefaria.hebrew.isHebrew(snippet) ? "rtl" : "ltr";
            snippet = $("<div>" + snippet.replace(/^[ .,;:!-)\]]+/, "") + "</div>").html();
            return {markup:{__html:snippet}, dir: dir};
        }

        var more_results_caret =
            (this.state.duplicatesShown)
            ? <i className="fa fa-caret-down fa-angle-down"></i>
            : <i className="fa fa-caret-down"></i>;

        var more_results_indicator = (!(data.duplicates)) ? "" :
                <div className='similar-trigger-box' onClick={this.toggleDuplicates}>
                    <span className='similar-title int-he'>
                        { data.duplicates.length } {(data.duplicates.length > 1) ? " גרסאות נוספות" : " גרסה נוספת"}
                    </span>
                    <span className='similar-title int-en'>
                        { data.duplicates.length } more version{(data.duplicates.length > 1) ? "s" : null}
                    </span>
                    {more_results_caret}
                </div>;

        var shown_duplicates = (data.duplicates && this.state.duplicatesShown) ?
            (<div className='similar-results'>
                    {data.duplicates.filter(result => !!result._source.version).map(function(result) {
                        var key = result._source.ref + "-" + result._source.version;
                        return <SearchTextResult
                            data={result}
                            key={key}
                            query={this.props.query}
                            onResultClick={this.props.onResultClick}
                            />;
                        }.bind(this))}
            </div>) : null;

        var snippetMarkup = get_snippet_markup();

        return (
            <div className="result text_result">
                <a href={href} onClick={this.handleResultClick}>
                    <div className="result-title">
                        <span className="en">{s.ref}</span>
                        <span className="he">{s.heRef}</span>
                    </div>
                    <div className="snippet" dir={snippetMarkup.dir} dangerouslySetInnerHTML={snippetMarkup.markup} ></div>
                    <div className="version" >{s.version}</div>
                </a>
                {more_results_indicator}
                {shown_duplicates}
            </div>
        )
    }
}

SearchTextResult.propTypes = {
    query: PropTypes.string,
    data: PropTypes.object,
    onResultClick: PropTypes.func
};


class SearchSheetResult extends Component {
    handleSheetClick(e) {
      var href = e.target.getAttribute("href");
      e.preventDefault();
      var s = this.props.data._source;
      Sefaria.site.track.event("Search", "Search Result Sheet Click", `${this.props.query} - ${s.sheetId}`,
          {hitCallback: () => window.location = href}
      );
    }
    handleProfileClick(e) {
      var href = e.target.getAttribute("href");
      e.preventDefault();
      var s = this.props.data._source;
      Sefaria.site.track.event("Search", "Search Result Sheet Owner Click", `${this.props.query} - ${s.sheetId} - ${s.owner_name}`,
          {hitCallback: () => window.location = href}
      );
    }
    render() {
        var data = this.props.data;
        var s = data._source;

        var snippet = data.highlight.content.join("..."); // data.highlight ? data.highlight.content.join("...") : s.content;
        snippet = $("<div>" + snippet.replace(/^[ .,;:!-)\]]+/, "") + "</div>").text();

        function get_version_markup() {
            return {__html: s.version};
        }
        var clean_title = $("<span>" + s.title + "</span>").text();
        var href = "/sheets/" + s.sheetId;
        return (
            <div className='result sheet_result'>
              <div className="result_img_box"><a href={s.profile_url} onClick={this.handleProfileClick}><img className='owner_image' src={s.owner_image} alt={s.owner_name} /></a></div>
              <div className="result_text_box">
                <a href={s.profile_url} onClick={this.handleProfileClick} className='owner_name'>{s.owner_name}</a>
                <a className='result-title' href={href} onClick={this.handleSheetClick}>{clean_title}</a>
                <div className="snippet">{snippet}</div>
              </div>
            </div>
        );
    }
}

SearchSheetResult.propTypes = {
  query: PropTypes.string,
  data: PropTypes.object
};


class AccountPanel extends Component {
  componentDidMount() {
    $(".inAppLink").on("click", this.props.handleInAppLinkClick);
  }
  render() {
    var width = typeof window !== "undefined" ? $(window).width() : 1000;
    var accountContent = [
      (<BlockLink interfaceLink={true} target="/my/profile" title="Profile" heTitle="פרופיל" image="/static/img/profile.svg" />),
      (<BlockLink interfaceLink={true} target="/sheets/private" inAppLink={true} title="Sheets" heTitle="דפי מקורות" image="/static/img/sheet.svg" />),
      (<BlockLink interfaceLink={true} target="/my/notes" inAppLink={true} title="Notes" heTitle="הערות" image="/static/img/tools-write-note.svg" />),
      (<BlockLink interfaceLink={true} target="/my/groups" inAppLink={true} title="Groups" heTitle="קבוצות" image="/static/img/group.svg" />),
      (<BlockLink interfaceLink={true} target="/texts/recent" title="Reading History" heTitle="היסטורית קריאה" image="/static/img/readinghistory.svg" />),
      (<BlockLink interfaceLink={true} target="/settings/account" title="Settings" heTitle="הגדרות" image="/static/img/settings.svg" />),
    ];
    accountContent = (<TwoOrThreeBox content={accountContent} width={width} />);

    var learnContent = [
      (<BlockLink interfaceLink={true} target="/about" title="About" heTitle="אודות" />),
      (<BlockLink interfaceLink={true} target="/help" title="Help" heTitle="עזרה" />),
      (<BlockLink interfaceLink={true} target="http://blog.sefaria.org" title="Blog" heTitle="בלוג" />),
      (<BlockLink interfaceLink={true} target="/faq" title="FAQ" heTitle="שאלות נפוצות" />),
      (<BlockLink interfaceLink={true} target="/educators" title="Educators" heTitle="מחנכים" />),
      (<BlockLink interfaceLink={true} target="/team" title="Team" heTitle="צוות" />)
    ];
    learnContent = (<TwoOrThreeBox content={learnContent} width={width} />);

    var contributeContent = [
      (<BlockLink interfaceLink={true} target="/activity" title="Recent Activity" heTitle="פעילות אחרונה" />),
      (<BlockLink interfaceLink={true} target="/metrics" title="Metrics" heTitle="מדדים" />),
      (<BlockLink interfaceLink={true} target="/contribute" title="Contribute" heTitle="הצטרפות לעשיה" />),
      (<BlockLink interfaceLink={true} target="/donate" title="Donate" heTitle="תרומות" />),
      (<BlockLink interfaceLink={true} target="/supporters" title="Supporters" heTitle="תומכים" />),
      (<BlockLink interfaceLink={true} target="/jobs" title="Jobs" heTitle="דרושים" />),
    ];
    contributeContent = (<TwoOrThreeBox content={contributeContent} width={width} />);

    var connectContent = [
      (<BlockLink interfaceLink={true} target="https://groups.google.com/forum/?fromgroups#!forum/sefaria" title="Forum" heTitle="פורום" />),
      (<BlockLink interfaceLink={true} target="http://www.facebook.com/sefaria.org" title="Facebook" heTitle="פייסבוק" />),
      (<BlockLink interfaceLink={true} target="http://twitter.com/SefariaProject" title="Twitter" heTitle="טוויטר" />),
      (<BlockLink interfaceLink={true} target="http://www.youtube.com/user/SefariaProject" title="YouTube" heTitle="יוטיוב" />),
      (<BlockLink interfaceLink={true} target="http://www.github.com/Sefaria" title="GitHub" heTitle="גיטהאב" />),
      (<BlockLink interfaceLink={true} target="mailto:hello@sefaria.org" title="Email" heTitle='אימייל' />)
    ];
    connectContent = (<TwoOrThreeBox content={connectContent} width={width} />);

    var footer =  (<footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                    <Footer />
                    </footer> );

    var classes = {accountPanel: 1, systemPanel: 1, readerNavMenu: 1, noHeader: 1 };
    var classStr = classNames(classes);
    return (
      <div className={classStr}>
        <div className="content hasFooter">
          <div className="contentInner">
            <h1>
              <a href="/logout" className="button transparent">
                <span className="int-en">Log Out</span>
                <span className="int-he">ניתוק</span>
              </a>
              <span className="int-en">Account</span>
              <span className="int-he">חשבון משתמש</span>
            </h1>
           <ReaderNavigationMenuSection content={accountContent} />
           <ReaderNavigationMenuSection title="Learn" heTitle="לימוד" content={learnContent} />
           <ReaderNavigationMenuSection title="Contribute" heTitle="עשייה" content={contributeContent} />
           <ReaderNavigationMenuSection title="Connect" heTitle="התחברות" content={connectContent} />
          </div>
            {footer}
        </div>
      </div>
      );
  }
}

AccountPanel.propTypes = {
  interfaceLang: PropTypes.string,
};


class RecentPanel extends Component {
  render() {
    var width = typeof window !== "undefined" ? $(window).width() : 1000;

    var recentItems = Sefaria.recentlyViewed.map(function(item) {
      return (<TextBlockLink
                sref={item.ref}
                heRef={item.heRef}
                book={item.book}
                version={item.version}
                versionLanguage={item.versionLanguage}
                showSections={true}
                recentItem={true} />)
    });
    var recentContent = (<TwoOrThreeBox content={recentItems} width={width} />);

    var footer = this.props.compare ? null :
                    (<footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                      <Footer />
                    </footer> );


    var navMenuClasses = classNames({recentPanel: 1, readerNavMenu: 1, noHeader: this.props.hideNavHeader, compare:this.props.compare});
    var navTopClasses  = classNames({readerNavTop: 1, searchOnly: 1, colorLineOnly: this.props.hideNavHeader});
    var contentClasses = classNames({content: 1, hasFooter: footer != null});
    return (
      <div className={navMenuClasses}>
        {this.props.hideNavHeader ? null :
          <div className={navTopClasses}>
            <CategoryColorLine category={"Other"} />
            <ReaderNavigationMenuMenuButton onClick={this.props.navHome} compare={this.props.compare} />
            <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
            <h2>
              <span className="int-en">Recent</span>
              <span className="int-he">נצפו לאחרונה</span>
            </h2>
        </div>}
        <div className={contentClasses}>
          <div className="contentInner">
            {this.props.hideNavHeader ?
              <h1>
              { this.props.multiPanel ? <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} /> : null }
              <span className="int-en">Recent</span>
              <span className="int-he">נצפו לאחרונה</span>
            </h1>
            : null }
            {recentContent}
          </div>
          {footer}
        </div>
      </div>
      );
  }
}

RecentPanel.propTypes = {
  closeNav:            PropTypes.func.isRequired,
  toggleLanguage:      PropTypes.func.isRequired,
  openDisplaySettings: PropTypes.func.isRequired,
  navHome:             PropTypes.func.isRequired,
  width:               PropTypes.number,
  compare:             PropTypes.bool,
  hideNavHeader:       PropTypes.bool,
  interfaceLang:       PropTypes.string
};


class NotificationsPanel extends Component {
  constructor(props) {
    super(props);

    this.state = {
      page: 1,
      loadedToEnd: false,
      loading: false
    };
  }
  componentDidMount() {
    $(ReactDOM.findDOMNode(this)).find(".content").bind("scroll", this.handleScroll);
    this.markAsRead();
  }
  componentDidUpdate() {
    this.markAsRead();
  }
  handleScroll() {
    if (this.state.loadedToEnd || this.state.loading) { return; }
    var $scrollable = $(ReactDOM.findDOMNode(this)).find(".content");
    var margin = 100;
    if($scrollable.scrollTop() + $scrollable.innerHeight() + margin >= $scrollable[0].scrollHeight) {
      this.getMoreNotifications();
    }
  }
  markAsRead() {
    // Marks each notification that is loaded into the page as read via API call
    var ids = [];
    $(".notification.unread").not(".marked").each(function() {
      ids.push($(this).attr("data-id"));
    });
    if (ids.length) {
      $.post("/api/notifications/read", {notifications: JSON.stringify(ids)}, function(data) {
        $(".notification.unread").addClass("marked");
        this.props.setUnreadNotificationsCount(data.unreadCount);
      }.bind(this));
    }
  }
  getMoreNotifications() {
    $.getJSON("/api/notifications?page=" + this.state.page, this.loadMoreNotifications);
    this.setState({loading: true});
  }
  loadMoreNotifications(data) {
    if (data.count < data.page_size) {
      this.setState({loadedToEnd: true});
    }
    Sefaria.notificationsHtml += data.html;
    this.setState({page: data.page + 1, loading: false});
    this.forceUpdate();
  }
  render() {
    var classes = {notificationsPanel: 1, systemPanel: 1, readerNavMenu: 1, noHeader: 1 };
    var classStr = classNames(classes);
    return (
      <div className={classStr}>
        <div className="content hasFooter">
          <div className="contentInner">
            <h1>
              <span className="int-en">Notifications</span>
              <span className="int-he">התראות</span>
            </h1>
            { Sefaria.loggedIn ?
              (<div className="notificationsList" dangerouslySetInnerHTML={ {__html: Sefaria.notificationsHtml } }></div>) :
              (<LoginPrompt fullPanel={true} />) }
          </div>
          <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
            <Footer />
          </footer>
        </div>
      </div>);
  }
}

NotificationsPanel.propTypes = {
  setUnreadNotificationsCount: PropTypes.func.isRequired,
  interfaceLang:               PropTypes.string,
};


class MyNotesPanel extends Component {
  componentDidMount() {
    this.loadData();
  }
  getInitialState() {
    return { numberToRender: 2 }
  }
  loadData() {
    var notes = Sefaria.allPrivateNotes();

    if (!notes) {
      Sefaria.allPrivateNotes(this.incrementNumberToRender);
    }
  }
  onScroll() {
    // Poor man's scrollview
    var $scrollable = $(ReactDOM.findDOMNode(this)).find(".content");
    var margin = 500;
    var $unloaded = $(".textRange.placeholder").eq(0);
    if (!$unloaded.length) { return; }
    if($scrollable.scrollTop() + $scrollable.innerHeight() + margin >= $unloaded.position().top) {
      this.incrementNumberToRender();
    }
  }
  incrementNumberToRender() {
    this.setState({numberToRender: this.state.numberToRender+3});
  }
  render() {
    var notes = Sefaria.allPrivateNotes();
    var classStr = classNames({myNotesPanel: 1, systemPanel: 1, readerNavMenu: 1, noHeader: this.props.hideNavHeader });
    var navTopClasses  = classNames({readerNavTop: 1, searchOnly: 1, colorLineOnly: this.props.hideNavHeader});
    var contentClasses = classNames({content: 1, hasFooter: 1});

    return (
      <div className={classStr}>
        {this.props.hideNavHeader ? null :
          <div className={navTopClasses}>
            <CategoryColorLine category={"Other"} />
            <ReaderNavigationMenuMenuButton onClick={this.props.navHome} />
            <ReaderNavigationMenuDisplaySettingsButton onClick={this.props.openDisplaySettings} />
            <h2>
              <span className="int-en">My Notes</span>
              <span className="int-he">הרשומות שלי</span>
            </h2>
        </div>}
        <div className={contentClasses} onScroll={this.onScroll}>
          <div className="contentInner">
            {this.props.hideNavHeader ?
              <h1>
                { this.props.multiPanel ? <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} /> : null }
                <span className="int-en">My Notes</span>
                <span className="int-he">הרשומות שלי</span>
              </h1>
              : null }
            <div className="noteList">
              { notes ?
                  (notes.length ?
                    notes.map(function(item, i) {
                      // All notes are rendered initially (so ctrl+f works on page) but text is only loaded
                      // from API as notes scroll into view.
                      return <NoteListing data={item} key={i} showText={i <= this.state.numberToRender} />
                    }.bind(this))
                    : <LoadingMessage message="You haven't written any notes yet." heMessage="טרם הוספת רשומות משלך" />)
                  : <LoadingMessage />
              }
            </div>

          </div>
          <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
            <Footer />
          </footer>
        </div>
      </div>);
  }
}

MyNotesPanel.propTypes = {
  interfaceLang:       PropTypes.string,
  mutliPanel:          PropTypes.bool,
  hideNavHeader:       PropTypes.bool,
  navHome:             PropTypes.func,
  toggleLanguage:      PropTypes.func,
  openDisplaySettings: PropTypes.func,
};


class NoteListing extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showSheetModal: false
    };
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevState.showSheetModal && this.state.showSheetModal) {
      this.positionSheetModal();
    }
  }
  showSheetModal() {
    this.setState({showSheetModal: true});
  }
  hideSheetModal() {
    this.setState({showSheetModal: false});
  }
  positionSheetModal() {
    $(".addToSourceSheetModal").position({my: "center center-40", at: "center center", of: window});
  }
  render() {
    var data = this.props.data;
    var url  = "/" + Sefaria.normRef(data.ref) + "?with=Notes";

    return (<div className="noteListing">
              <div className="addToSheetButton sans" onClick={this.showSheetModal}>
                <span className="int-en">Add to Sheet</span>
                <span className="int-he">הוסף לדף מקורות</span>
              </div>
              <a href={url}>
                {this.props.showText ?
                  <TextRange sref={data.ref} /> :
                  <span className="textRange placeholder">
                    <span className="title">
                      {data.ref}
                    </span>
                  </span> }
              </a>
              <Note text={data.text} />
              {this.state.showSheetModal ?
                <div>
                  <AddToSourceSheetWindow
                    srefs={[data.ref]}
                    note={data.text}
                    close={this.hideSheetModal} />
                  <div className="mask" onClick={this.hideSheetModal}></div>
                </div>
                : null }

            </div>);
  }
}

NoteListing.propTypes = {
  data:     PropTypes.object.isRequired,
  showText: PropTypes.bool,
};

NoteListing.defaultProps = {
  showText: true
};


class MyGroupsPanel extends Component {
  componentDidMount() {
    if (!Sefaria.groupsList()) {
      Sefaria.groupsList(function() {
        this.forceUpdate();
      }.bind(this));
    }
  }
  render() {
    var groupsList = Sefaria.groupsList();
    var classes = {myGroupsPanel: 1, systemPanel: 1, readerNavMenu: 1, noHeader: 1 };
    var classStr = classNames(classes);
    return (
      <div className={classStr}>
        <div className="content hasFooter">
          <div className="contentInner">
            <h1>
              <span className="int-en">My Groups</span>
              <span className="int-he">הקבוצות שלי</span>
            </h1>
            <center>
              <a className="button white" href="/groups/new">
                <span className="int-en">Create a Group</span>
                <span className="int-he">צור קבוצה</span>
              </a>
            </center>

            <div className="groupsList">
              { groupsList ?
                  (groupsList.private.length ?
                    groupsList.private.map(function(item) {
                      return <GroupListing data={item} />
                    })
                    : <LoadingMessage message="You aren't a member of any groups yet." heMessage="אינך חבר כרגע באף קבוצה" />)
                  : <LoadingMessage />
              }
            </div>

          </div>
          <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
            <Footer />
          </footer>
        </div>
      </div>);
  }
}

MyGroupsPanel.propTypes = {
  interfaceLang: PropTypes.string,
};


class GroupListing extends Component {
  render() {
    var imageUrl = this.props.data.imageUrl || "/static/img/group.svg"
    var imageClass = classNames({groupListingImage: 1, default: !this.props.data.imageUrl});
    var groupUrl = "/groups/" + this.props.data.name.replace(/\s/g, "-")
    return (<div className="groupListing">
              <a href={groupUrl}>
                <div className="groupListingImageBox">
                  <img className={imageClass} src={imageUrl} alt="Group Logo"/>
                </div>
              </a>
              <a href={groupUrl} className="groupListingName">{this.props.data.name}</a>
              <div className="groupListingDetails">
                <span className="groupListingDetail groupListingMemberCount">
                  <span className="int-en">{this.props.data.memberCount} Members</span>
                  <span className="int-he">{this.props.data.memberCount} חברים</span>
                </span>
                <span className="groupListingDetailSeparator">•</span>
                <span className="groupListingDetail groupListingSheetCount">
                  <span className="int-en">{this.props.data.sheetCount} Sheets</span>
                  <span className="int-he">{this.props.data.sheetCount} דפים</span>
                </span>
              </div>
              <div className="clearFix"></div>
            </div>);
  }
}

GroupListing.propTypes = {
  data: PropTypes.object.isRequired,
};


class ModeratorToolsPanel extends Component {
  constructor(props) {
    super(props);

    this.state = {
      // Bulk Download
      bulk_format: null,
      bulk_title_pattern: null,
      bulk_version_title_pattern: null,
      bulk_language: null,
      // CSV Upload
      files: [],
      uploading: false,
      uploadError: null,
      uploadMessage: null
    };
  }
  handleFiles(event) {
    this.setState({files: event.target.files});
  }
  uploadFiles(event) {
    event.preventDefault();
    this.setState({uploading: true, uploadMessage:"Uploading..."});
    var formData = new FormData();
    for (var i = 0; i < this.state.files.length; i++) {
      var file = this.state.files[i];
      formData.append('texts[]', file, file.name);
    }
    $.ajax({
      url: "api/text-upload",
      type: 'POST',
      data: formData,
      success: function(data) {
        if (data.status == "ok") {
          this.setState({uploading: false, uploadMessage: data.message, uploadError: null, files:[]});
          $("#file-form").get(0).reset(); //Remove selected files from the file selector
        } else {
          this.setState({"uploadError": "Error - " + data.error, uploading: false, uploadMessage: data.message});
        }
      }.bind(this),
      error: function(xhr, status, err) {
        this.setState({"uploadError": "Error - " + err.toString(), uploading: false, uploadMessage: null});
      }.bind(this),
      cache: false,
      contentType: false,
      processData: false
    });
  }

  onDlTitleChange(event) {
    this.setState({bulk_title_pattern: event.target.value});
  }
  onDlVersionChange(event) {
    this.setState({bulk_version_title_pattern: event.target.value});
  }
  onDlLanguageSelect(event) {
    this.setState({bulk_language: event.target.value});
  }
  onDlFormatSelect(event) {
    this.setState({bulk_format: event.target.value});
  }
  bulkVersionDlLink() {
    var args = ["format","title_pattern","version_title_pattern","language"].map(
        arg => this.state["bulk_" + arg]?`${arg}=${encodeURIComponent(this.state["bulk_"+arg])}`:""
    ).filter(a => a).join("&");
    return "download/bulk/versions/?" + args;
  }

  render () {
    // Bulk Download
    var dlReady = (this.state.bulk_format && (this.state.bulk_title_pattern || this.state.bulk_version_title_pattern));
    var downloadButton = <div className="versionDownloadButton">
        <div className="downloadButtonInner">
          <span className="int-en">Download</span>
          <span className="int-he">הורדה</span>
        </div>
      </div>;
    var downloadSection = (
      <div className="modToolsSection dlSection">
        <div className="dlSectionTitle">
          <span className="int-en">Bulk Download Text</span>
          <span className="int-he">הורדת הטקסט</span>
        </div>
        <input className="dlVersionSelect" type="text" placeholder="Index Title Pattern" onChange={this.onDlTitleChange} />
        <input className="dlVersionSelect" type="text" placeholder="Version Title Pattern" onChange={this.onDlVersionChange}/>
        <select className="dlVersionSelect dlVersionLanguageSelect" value={this.state.bulk_language || ""} onChange={this.onDlLanguageSelect}>
          <option disabled>Language</option>
          <option key="all" value="" >Hebrew & English</option>
          <option key="he" value="he" >Hebrew</option>
          <option key="en" value="en" >English</option>
        </select>
        <select className="dlVersionSelect dlVersionFormatSelect" value={this.state.bulk_format || ""} onChange={this.onDlFormatSelect}>
          <option disabled>File Format</option>
          <option key="txt" value="txt" >Text (with tags)</option>
          <option key="plain.txt" value="plain.txt" >Text (without tags)</option>
          <option key="csv" value="csv" >CSV</option>
          <option key="json" value="json" >JSON</option>
        </select>
        {dlReady?<a href={this.bulkVersionDlLink()} download>{downloadButton}</a>:downloadButton}
      </div>);

    // Uploading
    var ulReady = (!this.state.uploading) && this.state.files.length > 0;
    var uploadButton = <a><div className="versionDownloadButton" onClick={this.uploadFiles}><div className="downloadButtonInner">
       <span className="int-en">Upload</span>
       <span className="int-he">העלאה</span>
      </div></div></a>;
    var uploadForm = (
      <div className="modToolsSection">
        <div className="dlSectionTitle">
          <span className="int-en">Bulk Upload CSV</span>
          <span className="int-he">הורדת הטקסט</span>
        </div>
         <form id="file-form">
           <input className="dlVersionSelect" type="file" id="file-select"  multiple onChange={this.handleFiles}/>
           {ulReady?uploadButton:""}
         </form>
        {this.state.uploadMessage?<div className="message">{this.state.uploadMessage}</div>:""}
        {this.state.uploadError?<div className="error">{this.state.uploadError}</div>:""}
      </div>);

    return (Sefaria.is_moderator)?<div className="modTools">{downloadSection}{uploadForm}</div>:<div>Tools are only available to logged in moderators.</div>;
  }
}

ModeratorToolsPanel.propTypes = {
  interfaceLang: PropTypes.string
};


class UpdatesPanel extends Component {
  constructor(props) {
    super(props);

    this.state = {
      page: 0,
      loadedToEnd: false,
      loading: false,
      updates: [],
      submitting: false,
      submitCount: 0,
      error: null
    };
  }
  componentDidMount() {
    $(ReactDOM.findDOMNode(this)).find(".content").bind("scroll", this.handleScroll);
    this.getMoreNotifications();
  }
  handleScroll() {
    if (this.state.loadedToEnd || this.state.loading) { return; }
    var $scrollable = $(ReactDOM.findDOMNode(this)).find(".content");
    var margin = 100;
    if($scrollable.scrollTop() + $scrollable.innerHeight() + margin >= $scrollable[0].scrollHeight) {
      this.getMoreNotifications();
    }
  }
  getMoreNotifications() {
    $.getJSON("/api/updates?page=" + this.state.page, this.loadMoreNotifications);
    this.setState({loading: true});
  }
  loadMoreNotifications(data) {
    if (data.count < data.page_size) {
      this.setState({loadedToEnd: true});
    }
    this.setState({page: data.page + 1, loading: false, updates: this.state.updates.concat(data.updates)});
  }
  onDelete(id) {
    $.ajax({
        url: '/api/updates/' + id,
        type: 'DELETE',
        success: function(result) {
          if (result.status == "ok") {
              this.setState({updates: this.state.updates.filter(u => u._id != id)});
          }
        }.bind(this)
    });
  }
  handleSubmit(type, content) {
    this.setState({"submitting": true, "error": null});
    var payload = {
      type: type,
      content: content
    };
    $.ajax({
      url: "/api/updates",
      dataType: 'json',
      type: 'POST',
      data: {json: JSON.stringify(payload)},
      success: function(data) {
        if (data.status == "ok") {
          payload.date = Date();
          this.state.updates.unshift(payload);
          this.setState({submitting: false, updates: this.state.updates, submitCount: this.state.submitCount + 1});
        } else {
          this.setState({"error": "Error - " + data.error});
        }
      }.bind(this),
      error: function(xhr, status, err) {
        this.setState({"error": "Error - " + err.toString()});
        console.error(this.props.url, status, err.toString());
      }.bind(this)
    });
  }
  render() {
    var classes = {notificationsPanel: 1, systemPanel: 1, readerNavMenu: 1, noHeader: 1 };
    var classStr = classNames(classes);

    return (
      <div className={classStr}>
        <div className="content hasFooter">
          <div className="contentInner">
            <h1>
              <span className="int-en">Updates</span>
              <span className="int-he">עדכונים</span>
            </h1>

            {Sefaria.is_moderator?<NewUpdateForm handleSubmit={this.handleSubmit} key={this.state.submitCount} error={this.state.error}/>:""}

            <div className="notificationsList">
            {this.state.updates.map(u =>
                <SingleUpdate
                    type={u.type}
                    content={u.content}
                    date={u.date}
                    key={u._id}
                    id={u._id}
                    onDelete={this.onDelete}
                    submitting={this.state.submitting}
                />
            )}
            </div>
          </div>
          <footer id="footer" className={`interface-${this.props.interfaceLang} static sans`}>
                    <Footer />
                    </footer>
        </div>
      </div>);
  }
}

UpdatesPanel.propTypes = {
  interfaceLang:  PropTypes.string
};


class NewUpdateForm extends Component {
  constructor(props) {
    super(props);
    this.state = {type: 'index', index: '', language: 'en', version: '', en: '', he: '', error: ''};
  }
  componentWillReceiveProps(nextProps) {
    this.setState({"error": nextProps.error});
  }
  handleEnChange(e) {
    this.setState({en: e.target.value, error: null});
  }
  handleHeChange(e) {
    this.setState({he: e.target.value, error: null});
  }
  handleTypeChange(e) {
    this.setState({type: e.target.value, error: null});
  }
  handleIndexChange(e) {
    this.setState({index: e.target.value, error: null});
  }
  handleVersionChange(e) {
    this.setState({version: e.target.value, error: null});
  }
  handleLanguageChange(e) {
    this.setState({language: e.target.value, error: null});
  }
  handleSubmit(e) {
    e.preventDefault();
    var content = {
      "en": this.state.en.trim(),
      "he": this.state.he.trim()
    };
    if (this.state.type == "general") {
      if (!this.state.en || !this.state.he) {
        this.setState({"error": "Both Hebrew and English are required"});
        return;
      }
    } else {
      if (!this.state.index) {
        this.setState({"error": "Index is required"});
        return;
      }
      content["index"] = this.state.index.trim();
    }
    if (this.state.type == "version") {
      if (!this.state.version || !this.state.language) {
        this.setState({"error": "Version is required"});
        return;
      }
      content["version"] = this.state.version.trim();
      content["language"] = this.state.language.trim();
    }
    this.props.handleSubmit(this.state.type, content);

  }
  render() {
    return (
      <form className="globalUpdateForm" onSubmit={this.handleSubmit}>
        <div>
          <input type="radio" name="type" value="index" onChange={this.handleTypeChange} checked={this.state.type=="index"}/>Index&nbsp;&nbsp;
          <input type="radio" name="type" value="version" onChange={this.handleTypeChange} checked={this.state.type=="version"}/>Version&nbsp;&nbsp;
          <input type="radio" name="type" value="general" onChange={this.handleTypeChange} checked={this.state.type=="general"}/>General&nbsp;&nbsp;
        </div>
        <div>
          {(this.state.type != "general")?<input type="text" placeholder="Index Title" onChange={this.handleIndexChange} />:""}
          {(this.state.type == "version")?<input type="text" placeholder="Version Title" onChange={this.handleVersionChange}/>:""}
          {(this.state.type == "version")?<select type="text" placeholder="Version Language" onChange={this.handleLanguageChange}>
            <option value="en">English</option>
            <option value="he">Hebrew</option>
          </select>:""}
        </div>
        <div>
          <textarea
            placeholder="English Description (optional for Index and Version)"
            onChange={this.handleEnChange}
            rows="3"
            cols="80"
          />
        </div>
        <div>
          <textarea
            placeholder="Hebrew Description (optional for Index and Version)"
            onChange={this.handleHeChange}
            rows="3"
            cols="80"
          />
        </div>
        <input type="submit" value="Submit" disabled={this.props.submitting}/>
        <span className="error">{this.state.error}</span>
      </form>
    );
  }
}

NewUpdateForm.propTypes = {
  error:               PropTypes.string,
  handleSubmit:        PropTypes.func
};


class SingleUpdate extends Component {

  onDelete() {
    this.props.onDelete(this.props.id);
  }
  render() {
    var title = this.props.content.index;
    if (title) {
      var heTitle = Sefaria.index(title)?Sefaria.index(title).heTitle:"";
    }

    var url = Sefaria.ref(title)?"/" + Sefaria.normRef(Sefaria.ref(title).book):"/" + Sefaria.normRef(title);

    var d = new Date(this.props.date);

    return (
      <div className="notification">
        <div className="date">
          <span className="int-en">{d.toLocaleDateString("en")}</span>
          <span className="int-he">{d.toLocaleDateString("he")}</span>
          {Sefaria.is_moderator?<i className="fa fa-times-circle delete-update-button" onClick={this.onDelete} aria-hidden="true"/>:""}
        </div>

        {this.props.type == "index"?
        <div>
            <span className="int-en">New Text: <a href={url}>{title}</a></span>
            <span className="int-he">טקסט חדש זמין: <a href={url}>{heTitle}</a></span>
        </div>
        :""}

        {this.props.type == "version"?
        <div>
            <span className="int-en">New { this.props.content.language == "en"?"English":"Hebrew"} version of <a href={url}>{title}</a>: {this.props.content.version}</span>
            <span className="int-he">גרסה חדשה של <a href={url}>{heTitle}</a> ב{ this.props.content.language == "en"?"אנגלית":"עברית"} : {this.props.content.version}</span>
        </div>
        :""}

        <div>
            <span className="int-en" dangerouslySetInnerHTML={ {__html: this.props.content.en } } />
            <span className="int-he" dangerouslySetInnerHTML={ {__html: this.props.content.he } } />
        </div>


      </div>);
  }
}

SingleUpdate.propTypes = {
  id:         PropTypes.string,
  type:         PropTypes.string,
  content:      PropTypes.object,
  onDelete:     PropTypes.func,
  date:         PropTypes.string
};


class InterruptingMessage extends Component {
  constructor(props) {
    super(props);
    this.displayName = 'InterruptingMessage';
  }
  componentDidMount() {
    $("#interruptingMessage .button").click(this.close);
  }
  close() {
    this.markAsRead();
    this.props.onClose();
  }
  markAsRead() {
    Sefaria._api("/api/interrupting-messages/read/" + this.props.messageName, function (data) {});
    $.cookie(this.props.messageName, true, { "path": "/" });
    Sefaria.site.track.event("Interrupting Message", "read", this.props.messageName, { nonInteraction: true });
    Sefaria.interruptingMessage = null;
  }
  render() {
    return React.createElement(
      'div',
      { className: 'interruptingMessageBox' },
      React.createElement('div', { className: 'overlay', onClick: this.close }),
      React.createElement(
        'div',
        { id: 'interruptingMessage' },
        React.createElement(
          'div',
          { id: 'interruptingMessageClose', onClick: this.close },
          '×'
        ),
        React.createElement('div', { id: 'interruptingMessageContent', dangerouslySetInnerHTML: { __html: this.props.messageHTML } })
      )
    );
  }
}

InterruptingMessage.propTypes = {
  messageName: PropTypes.string.isRequired,
  messageHTML: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};


class ThreeBox extends Component {
  // Wrap a list of elements into a three column table
  render() {
      var content = this.props.content;
      var length = content.length;
      if (length % 3) {
          length += (3-length%3);
      }
      content.pad(length, "");
      var threes = [];
      for (var i=0; i<length; i+=3) {
        threes.push([content[i], content[i+1], content[i+2]]);
      }
      return (
        <table className="gridBox threeBox">
          <tbody>
          {
            threes.map(function(row, i) {
              return (
                <tr key={i}>
                  {row[0] ? (<td>{row[0]}</td>) : null}
                  {row[1] ? (<td>{row[1]}</td>) : null}
                  {row[2] ? (<td>{row[2]}</td>) : null}
                </tr>
              );
            })
          }
          </tbody>
        </table>
      );
  }
}


class TwoBox extends Component {
  // Wrap a list of elements into a three column table
  render() {
      var content = this.props.content;
      var length = content.length;
      if (length % 2) {
          length += (2-length%2);
      }
      content.pad(length, "");
      var twos = [];
      for (var i=0; i<length; i+=2) {
        twos.push([content[i], content[i+1]]);
      }
      return (
        <table className="gridBox twoBox">
          <tbody>
          {
            twos.map(function(row, i) {
              return (
                <tr key={i}>
                  {row[0] ? (<td>{row[0]}</td>) : <td className="empty"></td>}
                  {row[1] ? (<td>{row[1]}</td>) : <td className="empty"></td>}
                </tr>
              );
            })
          }
          </tbody>
        </table>
      );
  }
}

TwoBox.propTypes = {
  content: PropTypes.array.isRequired
};


class TwoOrThreeBox extends Component {
  // Wrap a list of elements into a two or three column table, depending on window width
  render() {
      var threshhold = this.props.threshhold;
      if (this.props.width > threshhold) {
        return (<ThreeBox content={this.props.content} />);
      } else {
        return (<TwoBox content={this.props.content} />);
      }
  }
}

TwoOrThreeBox.propTypes = {
  content:    PropTypes.array.isRequired,
  width:      PropTypes.number.isRequired,
  threshhold: PropTypes.number
};

TwoOrThreeBox.defaultProps = {
  threshhold: 500
};


class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      optionsOpen: false,
      selected: null
    };
  }
  select(option) {
    this.setState({selected: option, optionsOpen: false});
    this.props.onSelect && this.props.onSelect(option.value);
  }
  toggle() {
    this.setState({optionsOpen: !this.state.optionsOpen});
  }
  render() {
    return (
        <div className="dropdown sans">
          <div className="dropdownMain noselect" onClick={this.toggle}>
            <i className="dropdownOpenButton noselect fa fa-caret-down"></i>
            {this.state.selected ? this.state.selected.label : this.props.placeholder }
          </div>
          {this.state.optionsOpen ?
            <div className="dropdownListBox noselect">
              <div className="dropdownList noselect">
                {this.props.options.map(function(option) {
                  var onClick = this.select.bind(null, option);
                  var classes = classNames({dropdownOption: 1, selected: this.state.selected && this.state.selected.value == option.value});
                  return <div className={classes} onClick={onClick} key={option.value}>{option.label}</div>
                }.bind(this))}
              </div>
            </div>
          : null}
        </div>);
  }
}

Dropdown.propTypes = {
  options:     PropTypes.array.isRequired, // Array of {label, value}
  onSelect:    PropTypes.func,
  placeholder: PropTypes.string,
  selected:    PropTypes.string,
};


class LoadingMessage extends Component {
  render() {
    var message = this.props.message || "Loading...";
    var heMessage = this.props.heMessage || "טוען מידע...";
    var classes = "loadingMessage " + (this.props.className || "");
    return (<div className={classes}>
              <span className="int-en">{message}</span>
              <span className="int-he">{heMessage}</span>
            </div>);
  }
}

LoadingMessage.propTypes = {
  message:   PropTypes.string,
  heMessage: PropTypes.string,
  className: PropTypes.string
};


class TestMessage extends Component {
  // Modal explaining development status with links to send feedback or go back to the old site
  render() {
    return (
      <div className="testMessageBox">
        <div className="overlay" onClick={this.props.hide} ></div>
        <div className="testMessage">
          <div className="title">The new Sefaria is still in development.<br />Thank you for helping us test and improve it.</div>
          <a href="mailto:hello@sefaria.org" target="_blank" className="button">Send Feedback</a>
          <div className="button" onClick={backToS1} >Return to Old Sefaria</div>
        </div>
      </div>);
  }
}

TestMessage.propTypes = {
  hide:   PropTypes.func
};


class Footer extends Component {
  trackLanguageClick(language){
    Sefaria.site.track.setInterfaceLanguage('interface language footer', language);
  }
  render(){
    var currentPath = Sefaria.util.currentPath();
    var currentPathEncoded = encodeURIComponent(currentPath);
    var next = currentPathEncoded ? currentPathEncoded : '?home';
    return (
        <div id="footerInner">
          <div className="section">

              <div className="header">
                  <span className="int-en">About</span>
                  <span className="int-he">אודות</span>
              </div>
              <a href="/about" className="outOfAppLink">
                  <span className="int-en">What is Sefaria?</span>
                  <span className="int-he">מהי ספאריה</span>
              </a>
              <a href="/help" className="outOfAppLink">
                  <span className="int-en">Help</span>
                  <span className="int-he">עזרה</span>
              </a>
              <a href="https://blog.sefaria.org" target="_blank" className="outOfAppLink">
                  <span className="int-en">Blog</span>
                  <span className="int-he">בלוג</span>
              </a>
              <a href="/faq" target="_blank" className="outOfAppLink">
                  <span className="int-en">FAQ</span>
                  <span className="int-he">שאלות נפוצות</span>
              </a>
              <a href="/team" className="outOfAppLink">
                  <span className="int-en">Team</span>
                  <span className="int-he">צוות</span>
              </a>
              <a href="/terms" className="outOfAppLink">
                  <span className="int-en">Terms of Use</span>
                  <span className="int-he">תנאי שימוש</span>
              </a>
              <a href="/privacy-policy" className="outOfAppLink">
                  <span className="int-en">Privacy Policy</span>
                  <span className="int-he">מדיניות הפרטיות</span>
              </a>
          </div>

          <div className="section">
              <div className="header">
                      <span className="int-en">Educators</span>
                      <span className="int-he">מחנכים</span>
              </div>
              <a href="/educators" className="outOfAppLink">
                  <span className="int-en">Teach with Sefaria</span>
                  <span className="int-he">למד באמצעות ספאריה</span>
              </a>
              <a href="/sheets" className="outOfAppLink">
                  <span className="int-en">Source Sheets</span>
                  <span className="int-he">דפי מקורות</span>
              </a>
              <a href="/visualizations" className="outOfAppLink">
                  <span className="int-en">Visualizations</span>
                  <span className="int-he">עזרים חזותיים</span>
              </a>
              <a href="/people" className="outOfAppLink">
                  <span className="int-en">Authors</span>
                  <span className="int-he">מחברים</span>
              </a>
              <a href="/updates" className="outOfAppLink">
                  <span className="int-en">New Additions</span>
                  <span className="int-he">מה חדש</span>
              </a>
          </div>

          <div className="section">
              <div className="header">
                  <span className="int-en">Developers</span>
                  <span className="int-he">מפתחים</span>
              </div>
              <a href="/developers" target="_blank" className="outOfAppLink">
                  <span className="int-en">Get Involved</span>
                  <span className="int-he">הצטרף אלינו</span>
              </a>
              <a href="/developers#api" target="_blank" className="outOfAppLink">
                  <span className="int-en">API Docs</span>
                  <span className="int-he">מסמכי API</span>
              </a>
              <a href="https://github.com/Sefaria/Sefaria-Project" target="_blank" className="outOfAppLink">
                  <span className="int-en">Fork us on GitHub</span>
                  <span className="int-he">זלגו חופשי מגיטהאב</span>
              </a>
              <a href="https://github.com/Sefaria/Sefaria-Export" target="_blank" className="outOfAppLink">
                  <span className="int-en">Download our Data</span>
                  <span className="int-he">הורד את בסיס הנתונים שלנו</span>
              </a>
          </div>

          <div className="section">
              <div className="header">
                  <span className="int-en">Join Us</span>
                  <span className="int-he">הצטרף אלינו</span>
              </div>
              <a href="/donate" className="outOfAppLink">
                  <span className="int-en">Donate</span>
                  <span className="int-he">תרומות</span>
              </a>
              <a href="/supporters" className="outOfAppLink">
                  <span className="int-en">Supporters</span>
                  <span className="int-he">תומכים</span>
              </a>
              <a href="/contribute" target="_blank" className="outOfAppLink">
                  <span className="int-en">Contribute</span>
                  <span className="int-he">הצטרף</span>
              </a>
              <a href="/jobs" className="outOfAppLink">
                  <span className="int-en">Jobs</span>
                  <span className="int-he">דרושים</span>
              </a>
          </div>

          <div className="section last">
              <div className="header">
                  <span className="int-en">Connect</span>
                  <span className="int-he">התחבר</span>
              </div>
              <a href="http://www.facebook.com/sefaria.org" target="_blank" className="outOfAppLink">
                  <i className="fa fa-facebook-official"></i>
                  <span className="int-en">Facebook</span>
                  <span className="int-he">פייסבוק</span>

              </a>
              <a href="http://twitter.com/SefariaProject" target="_blank" className="outOfAppLink">
                  <i className="fa fa-twitter"></i>
                  <span className="int-en">Twitter</span>
                  <span className="int-he">טוויטר</span>

              </a>
              <a href="http://www.youtube.com/user/SefariaProject" target="_blank" className="outOfAppLink">
                  <i className="fa fa-youtube"></i>
                  <span className="int-en">YouTube</span>
                  <span className="int-he">יוטיוב</span>

              </a>
              <a href="https://groups.google.com/forum/?fromgroups#!forum/sefaria" target="_blank" className="outOfAppLink">
                  <span className="int-en">Forum</span>
                  <span className="int-he">פורום</span>

              </a>
              <a href="mailto:hello@sefaria.org" target="_blank" className="outOfAppLink">
                  <span className="int-en">Email</span>
                  <span className="int-he">דוא&quot;ל</span>
              </a>
              <div id="siteLanguageToggle">
                  <div id="siteLanguageToggleLabel">
                      <span className="int-en">Site Language:</span>
                      <span className="int-he">שפת האתר</span>
                  </div>
                  <a href={"/interface/english?next=" + next} id="siteLanguageEnglish" className="outOfAppLink"
                     onClick={this.trackLanguageClick.bind(null, "English")}>English
                  </a>
                  |
                  <a href={"/interface/hebrew?next=" + next} id="siteLanguageHebrew" className="outOfAppLink"
                      onClick={this.trackLanguageClick.bind(null, "Hebrew")}>עברית
                  </a>
              </div>
          </div>
        </div>
    );
  }
}


var openInNewTab = function(url) {
  var win = window.open(url, '_blank');
  win.focus();
};


var backToS1 = function() {
  $.cookie("s2", "", {path: "/"});
  window.location = "/";
};


exports.ReaderApp           = ReaderApp;
exports.ReaderPanel         = ReaderPanel;
exports.ConnectionsPanel    = ConnectionsPanel;
exports.TextRange           = TextRange;
exports.TextColumn          = TextColumn;
exports.Footer              = Footer;
exports.sefariaSetup        = Sefaria.setup;
exports.unpackDataFromProps = Sefaria.unpackDataFromProps;
exports.EditGroupPage       = EditGroupPage;
